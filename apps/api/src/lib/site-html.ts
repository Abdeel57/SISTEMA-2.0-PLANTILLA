import type { FastifyRequest } from 'fastify';
import { isCurrency, isLocale } from '@bismark/shared';
import { prisma } from './prisma.js';
import { env } from '../config/env.js';
import { escapeHtml } from './mailer.js';
import { shareCardRelUrl } from '../modules/og/share-card.js';

// Inyecta la marca del rifero del sitio (favicon, título y meta tags Open Graph)
// en el index.html que sirve el backend. Así, ANTES de que cargue el JS:
//   - la pestaña del navegador muestra el logo y el nombre de la página de rifas;
//   - al compartir CUALQUIER enlace del sitio (incluida una rifa), la vista previa
//     usa el logo y el nombre de la página, no los del evento.
// Es single-tenant: hay un solo rifero por despliegue. Se cachea el perfil unos
// segundos para no pegarle a la BD en cada carga de HTML.

interface BrandProfile {
  publicName: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  publicDarkMode: boolean;
  locale: string;
  currency: string;
  facebookPixelId: string | null;
  facebookDomainVerification: string | null;
}

let cache: { profile: BrandProfile | null; at: number } | null = null;
const TTL_MS = 30_000;

async function getSiteProfile(): Promise<BrandProfile | null> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.profile;
  const profile = await prisma.riferoProfile.findFirst({
    orderBy: { createdAt: 'asc' },
    select: {
      publicName: true,
      description: true,
      logoUrl: true,
      coverUrl: true,
      publicDarkMode: true,
      locale: true,
      currency: true,
      facebookPixelId: true,
      facebookDomainVerification: true,
    },
  });
  cache = { profile, at: now };
  return profile;
}

function absolute(url: string | null | undefined, request: FastifyRequest): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  const base = env.publicWebUrl || `${request.protocol}://${request.headers.host ?? ''}`;
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`;
}

// Reemplaza el content de <meta property="X" ...> sin romper si el valor trae $.
function setProp(html: string, prop: string, value: string): string {
  const re = new RegExp(`(<meta property="${prop}" content=")[^"]*(")`);
  return html.replace(re, (_m, a: string, b: string) => `${a}${escapeHtml(value)}${b}`);
}
function setName(html: string, name: string, value: string): string {
  const re = new RegExp(`(<meta name="${name}" content=")[^"]*(")`);
  return html.replace(re, (_m, a: string, b: string) => `${a}${escapeHtml(value)}${b}`);
}

// Código base OFICIAL del pixel de Meta, palabra por palabra como lo entrega
// Events Manager. Va dentro del <head> del HTML que sirve el backend —no
// inyectado por JavaScript— por dos razones: aparece en el código fuente de la
// página (es lo que revisa el rastreador de Meta y el cliente al inspeccionar) y
// el PageView sale de inmediato, sin esperar a que responda la API del perfil.
//
// El ID se filtra a DÍGITOS: entra dentro de un <script>, donde escapar HTML no
// serviría de nada y un valor con comillas sería una inyección de código.
function metaPixelSnippet(rawId: string): string {
  const id = rawId.replace(/[^0-9]/g, '');
  if (!id) return '';
  return `    <!-- Meta Pixel Code -->
    <script>
    !function(f,b,e,v,n,t,s)
    {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s)}(window, document,'script',
    'https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '${id}');
    fbq('track', 'PageView');
    </script>
    <noscript><img height="1" width="1" style="display:none"
    src="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1"
    /></noscript>
    <!-- End Meta Pixel Code -->
`;
}

// Mete en el <head> la verificación de dominio y el pixel de Meta. Función pura
// (recibe el HTML y devuelve el HTML) para poder probarla sin base de datos.
export function injectMeta(
  rawHtml: string,
  rawPixelId: string | null | undefined,
  rawVerification: string | null | undefined,
): string {
  let html = rawHtml;

  // La verificación de dominio es una meta etiqueta que Meta lee SIN ejecutar
  // JavaScript, así que tiene que venir en el HTML del servidor: por eso el
  // rifero no podía ponerla desde el panel hasta ahora.
  const verification = (rawVerification ?? '').replace(/[^A-Za-z0-9_-]/g, '');
  if (verification) {
    html = html.replace(
      '</head>',
      `  <meta name="facebook-domain-verification" content="${escapeHtml(verification)}" />\n  </head>`,
    );
  }

  const pixelId = (rawPixelId ?? '').replace(/[^0-9]/g, '');
  if (pixelId) {
    html = html.replace('</head>', `${metaPixelSnippet(pixelId)}  </head>`);
    // Marca para el frontend: el pixel YA quedó iniciado y su PageView ya salió.
    // Sin esto, el hook useFacebookPixel mandaría un segundo PageView por carga.
    html = html.replace('<html', `<html data-fb-pixel="${pixelId}"`);
  }

  return html;
}

const ADMIN_TITLE = 'Bismark | ADMIN';

// El administrador (/admin, /login) es SIEMPRE la marca Bismark, nunca la del
// rifero: el panel es del producto. Por eso NO le inyectamos el logo/nombre del
// organizador. Le dejamos los íconos estáticos de Bismark, el título "Bismark |
// ADMIN" y un manifest dedicado (abre directo en /admin con el ícono de Bismark),
// para que al "Agregar a inicio" o compartir se vea Bismark, no el rifero.
function renderAdminIndex(rawHtml: string): string {
  let html = rawHtml;
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${ADMIN_TITLE}</title>`);
  html = setName(html, 'apple-mobile-web-app-title', ADMIN_TITLE);
  html = html.replace('href="/manifest.webmanifest"', 'href="/admin.webmanifest"');
  return html;
}

export async function renderBrandedIndex(rawHtml: string, request: FastifyRequest): Promise<string> {
  const path = (request.url || '/').split('?')[0];
  if (path === '/login' || path === '/admin' || path.startsWith('/admin/')) {
    return renderAdminIndex(rawHtml);
  }

  let profile: BrandProfile | null = null;
  try {
    profile = await getSiteProfile();
  } catch {
    // Si la BD no responde, servimos el HTML sin marca (mejor que romper la carga).
    return rawHtml;
  }
  if (!profile) return rawHtml;

  const base = env.publicWebUrl || `${request.protocol}://${request.headers.host ?? ''}`;
  const name = profile.publicName;
  const description =
    profile.description?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) ||
    'Aparta tus boletos, paga fácil y recibe tu boleto digital con QR.';
  const logo = absolute(profile.logoUrl, request);
  // Vista previa al compartir: tarjeta 1:1 con el logo sobre fondo blanco (ver
  // modules/og/share-card.ts). El `?v=` invalida la caché de las redes al cambiar el logo.
  const ogImage = absolute(shareCardRelUrl(profile), request);

  let html = rawHtml;

  // Tema oscuro de la página pública (lo elige el rifero). Se inyecta la clase
  // `dark` en <html> ANTES de que cargue el JS para no parpadear (claro→oscuro).
  // (Las rutas del administrador ya salieron arriba por renderAdminIndex.)
  if (profile.publicDarkMode) {
    html = html.replace(/<html(\s[^>]*)?>/i, (m, attrs: string | undefined) => {
      const a = attrs ?? '';
      return /class\s*=/.test(a)
        ? `<html${a.replace(/class\s*=\s*"([^"]*)"/i, (_x, c: string) => `class="${c} dark"`)}>`
        : `<html${a} class="dark">`;
    });
    html = setName(html, 'theme-color', '#0f172a');
  }

  // Idioma y moneda del sitio ("Modo USA"), por la misma razón que el tema: el
  // store del frontend los lee de estos atributos en el primer render, así la
  // página nunca se ve un instante en español antes de cambiar a inglés.
  const locale = isLocale(profile.locale) ? profile.locale : 'es';
  const currency = isCurrency(profile.currency) ? profile.currency : 'MXN';
  html = html.replace(/<html(\s[^>]*)?>/i, (_m, attrs: string | undefined) => {
    const a = (attrs ?? '').replace(/\slang\s*=\s*"[^"]*"/i, '');
    return `<html${a} lang="${locale}" data-locale="${locale}" data-currency="${currency}">`;
  });

  // Título de la pestaña → nombre de la página de rifas.
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(name)}</title>`);

  // Favicon → logo del rifero (si tiene uno). Sustituye los íconos estáticos.
  if (logo) {
    html = html
      .replace(/\s*<link rel="icon"[^>]*>/g, '')
      .replace(/(<link rel="apple-touch-icon")[^>]*\/>/, `$1 href="${escapeHtml(logo)}" />`)
      .replace('</head>', `  <link rel="icon" href="${escapeHtml(logo)}" />\n  </head>`);
  }

  // Open Graph / Twitter → identidad de la página.
  html = setProp(html, 'og:site_name', name);
  html = setProp(html, 'og:title', name);
  html = setProp(html, 'og:description', description);
  html = setName(html, 'description', description);
  html = setName(html, 'apple-mobile-web-app-title', name);
  if (ogImage) {
    html = setProp(html, 'og:image', ogImage);
    html = setName(html, 'twitter:image', ogImage);
  }
  // og:url (canónica del sitio). Si no existe el tag, lo añadimos.
  if (/<meta property="og:url"/.test(html)) {
    html = setProp(html, 'og:url', base);
  } else {
    html = html.replace('</head>', `  <meta property="og:url" content="${escapeHtml(base)}" />\n  </head>`);
  }

  // Meta (Facebook): verificación de dominio + pixel. Solo en páginas públicas
  // (el administrador salió antes por renderAdminIndex).
  html = injectMeta(html, profile.facebookPixelId, profile.facebookDomainVerification);

  return html;
}
