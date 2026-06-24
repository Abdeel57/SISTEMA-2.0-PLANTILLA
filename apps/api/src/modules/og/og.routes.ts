// Open Graph dinámico para compartir (WhatsApp, Facebook, Telegram…).
//
// Los crawlers no ejecutan JS, así que no leen los meta tags que React inyecta.
// Estos endpoints devuelven HTML real con meta tags OG por rifa/rifero y
// redirigen al SPA (que sirve este mismo proceso) para humanos.
//
// Los botones de "compartir" del frontend deben compartir estas URLs `/s/...`
// (no las del SPA) para que la vista previa muestre el premio/imagen.

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { env } from '../../config/env.js';
import { escapeHtml } from '../../lib/mailer.js';
import { prisma } from '../../lib/prisma.js';
import { findSiteProfile } from '../public/public.routes.js';
import { composeShareCard, shareCardRelUrl, shareCardSource } from './share-card.js';

// Base pública del sitio: PUBLIC_WEB_URL si está definida; si no, el host de la
// petición (frontend y API comparten origen en producción).
function siteBase(request: FastifyRequest): string {
  return env.publicWebUrl || `${request.protocol}://${request.headers.host ?? ''}`;
}

// Convierte una ruta de archivo de la API (p. ej. "/uploads/..") en URL absoluta.
function toAbsoluteApiUrl(pathOrUrl: string | null | undefined, request: FastifyRequest): string | null {
  if (!pathOrUrl) return null;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = env.publicApiUrl || `${request.protocol}://${request.headers.host ?? ''}`;
  return `${base}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

function parseEventNumber(raw: string): number {
  const n = Number(raw.replace(/^e/i, ''));
  return Number.isInteger(n) && n >= 1 ? n : NaN;
}

interface OgData {
  title: string;
  description: string;
  image: string | null;
  fallbackImage: string; // imagen de respaldo (og-default.png del sitio)
  siteName: string; // nombre de la página de rifas (no "Bismark")
  url: string; // URL canónica a compartir (esta misma /s/...)
  redirectUrl: string; // a dónde mandar al humano (SPA)
}

function renderOgHtml(d: OgData): string {
  const image = d.image || d.fallbackImage;
  const img = `<meta property="og:image" content="${escapeHtml(image)}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="1200" />
    <meta property="og:image:alt" content="${escapeHtml(d.title)}" />
    <meta name="twitter:image" content="${escapeHtml(image)}" />`;
  const redirect = escapeHtml(d.redirectUrl);
  return `<!doctype html>
<html lang="es-MX">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(d.title)}</title>
  <meta name="description" content="${escapeHtml(d.description)}" />
  <link rel="canonical" href="${escapeHtml(d.url)}" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="${escapeHtml(d.siteName)}" />
  <meta property="og:title" content="${escapeHtml(d.title)}" />
  <meta property="og:description" content="${escapeHtml(d.description)}" />
  <meta property="og:url" content="${escapeHtml(d.url)}" />
  ${img}
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(d.title)}" />
  <meta name="twitter:description" content="${escapeHtml(d.description)}" />

  <meta http-equiv="refresh" content="0; url=${redirect}" />
  <script>location.replace(${JSON.stringify(d.redirectUrl)});</script>
</head>
<body style="font-family:system-ui,sans-serif;background:#070b18;color:#fff;display:grid;place-items:center;height:100vh;margin:0;">
  <p>Abriendo… Si no avanza, <a href="${redirect}" style="color:#7aa2ff;">toca aquí</a>.</p>
</body>
</html>`;
}

// IMPORTANTE: el handler async debe RETORNAR esta promesa (return sendOg(...)).
// Si se llama sin return, el `return undefined` implícito del handler compite
// con el stream de @fastify/compress y la respuesta sale gzip con cuerpo vacío.
function sendOg(reply: FastifyReply, html: string): FastifyReply {
  return reply
    .header('Content-Type', 'text/html; charset=utf-8')
    .header('Cache-Control', 'public, max-age=300') // 5 min: equilibra frescura y caché de crawlers
    .send(html);
}

export default async function ogRoutes(app: FastifyInstance): Promise<void> {
  // GET /s/r/:slug — vista previa de la página del rifero
  app.get('/s/r/:slug', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const profile = await findSiteProfile(slug);

    // Single-tenant: la página del rifero ES la raíz del sitio.
    const base = siteBase(request);
    const fallbackImage = `${base}/og-default.png`;
    const shareUrl = `${env.publicApiUrl || base}/s/r/${encodeURIComponent(slug)}`;

    if (!profile || profile.status === 'DELETED') {
      return sendOg(
        reply,
        renderOgHtml({
          title: 'Rifas y sorteos',
          description: 'Aparta tus boletos y paga fácil desde el celular.',
          image: null,
          fallbackImage,
          siteName: 'Rifas y sorteos',
          url: shareUrl,
          redirectUrl: base,
        }),
      );
    }

    const html = renderOgHtml({
      title: profile.publicName,
      description:
        profile.description?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) ||
        `Participa en las rifas de ${profile.publicName}. Aparta tus boletos y paga fácil.`,
      image: toAbsoluteApiUrl(shareCardRelUrl(profile), request),
      fallbackImage,
      siteName: profile.publicName,
      url: shareUrl,
      redirectUrl: base,
    });
    return sendOg(reply, html);
  });

  // GET /s/r/:slug/:eventNumber — vista previa de una rifa
  app.get('/s/r/:slug/:eventNumber', async (request, reply) => {
    const { slug, eventNumber } = request.params as { slug: string; eventNumber: string };
    const n = parseEventNumber(eventNumber);
    const base = siteBase(request);
    const fallbackImage = `${base}/og-default.png`;
    const shareUrl = `${env.publicApiUrl || base}/s/r/${encodeURIComponent(slug)}/e${Number.isNaN(n) ? '' : n}`;

    const profile = Number.isNaN(n) ? null : await findSiteProfile(slug);

    if (!profile || Number.isNaN(n)) {
      return sendOg(
        reply,
        renderOgHtml({
          title: 'Rifas y sorteos',
          description: 'Aparta tus boletos y paga fácil desde el celular.',
          image: null,
          fallbackImage,
          siteName: 'Rifas y sorteos',
          url: shareUrl,
          redirectUrl: base,
        }),
      );
    }

    // Identidad de la PÁGINA del rifero (nombre + logo), no del evento:
    // al compartir cualquier rifa se ve siempre el logo de la página de rifas.
    // El humano sí aterriza en la rifa concreta (/eN).
    return sendOg(
      reply,
      renderOgHtml({
        title: profile.publicName,
        description:
          profile.description?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) ||
          `Participa en las rifas de ${profile.publicName}. Aparta tus boletos y paga fácil.`,
        image: toAbsoluteApiUrl(shareCardRelUrl(profile), request),
        fallbackImage,
        siteName: profile.publicName,
        url: shareUrl,
        redirectUrl: `${base}/e${n}`,
      }),
    );
  });

  // GET /s/card.png — tarjeta 1:1 (logo del rifero centrado sobre blanco) que se
  // usa como og:image al compartir. El `?v=` lo añade quien genera el enlace para
  // invalidar la caché de las redes cuando cambia el logo.
  app.get('/s/card.png', async (request, reply) => {
    const profile = await prisma.riferoProfile.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { logoUrl: true, coverUrl: true },
    });
    const png = await composeShareCard(shareCardSource(profile));
    if (!png) {
      // Sin logo utilizable: cae a la imagen por defecto del sitio.
      return reply.redirect(`${siteBase(request)}/og-default.png`);
    }
    return reply
      .header('Content-Type', 'image/png')
      .header('Cache-Control', 'public, max-age=300')
      .send(png);
  });
}
