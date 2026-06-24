import type { FastifyRequest } from 'fastify';
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
}

let cache: { profile: BrandProfile | null; at: number } | null = null;
const TTL_MS = 30_000;

async function getSiteProfile(): Promise<BrandProfile | null> {
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.profile;
  const profile = await prisma.riferoProfile.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { publicName: true, description: true, logoUrl: true, coverUrl: true, publicDarkMode: true },
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

export async function renderBrandedIndex(rawHtml: string, request: FastifyRequest): Promise<string> {
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
  // El administrador (/admin, /login) siempre va en claro: ahí no se inyecta.
  const path = (request.url || '/').split('?')[0];
  const isAdminRoute = path === '/login' || path === '/admin' || path.startsWith('/admin/');
  if (profile.publicDarkMode && !isAdminRoute) {
    html = html.replace(/<html(\s[^>]*)?>/i, (m, attrs: string | undefined) => {
      const a = attrs ?? '';
      return /class\s*=/.test(a)
        ? `<html${a.replace(/class\s*=\s*"([^"]*)"/i, (_x, c: string) => `class="${c} dark"`)}>`
        : `<html${a} class="dark">`;
    });
    html = setName(html, 'theme-color', '#0f172a');
  }

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

  return html;
}
