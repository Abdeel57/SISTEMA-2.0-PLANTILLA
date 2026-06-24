import Fastify, { type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import compress from '@fastify/compress';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { SESSION_COOKIE } from './lib/auth.js';
import { isAllowedOrigin } from './lib/origins.js';
import { renderBrandedIndex } from './lib/site-html.js';
import { authenticate } from './middlewares/auth.js';
import { csrfGuard } from './middlewares/csrf.js';
import { registerErrorHandler } from './middlewares/error-handler.js';

// Módulos de rutas
import authRoutes from './modules/auth/auth.routes.js';
import riferosRoutes from './modules/riferos/riferos.routes.js';
import rafflesRoutes from './modules/raffles/raffles.routes.js';
import ticketsRoutes from './modules/tickets/tickets.routes.js';
import ordersRoutes from './modules/orders/orders.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import paymentsRoutes from './modules/payments/payments.routes.js';
import winnersRoutes from './modules/winners/winners.routes.js';
import digitalTicketsRoutes from './modules/digital-tickets/digital-tickets.routes.js';
import reportsRoutes from './modules/reports/reports.routes.js';
import publicRoutes from './modules/public/public.routes.js';
import uploadsRoutes from './modules/uploads/uploads.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';
import ogRoutes from './modules/og/og.routes.js';
import pushRoutes from './modules/push/push.routes.js';
import liveRoutes from './modules/live/live.routes.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: env.isProd
      ? true
      : { transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } } },
    trustProxy: true,
    bodyLimit: 2 * 1024 * 1024, // 2 MB para JSON; archivos van por multipart
  });

  // Cabeceras de seguridad. Es una API JSON: desactivamos CSP (la define el frontend en Netlify).
  await app.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }, // permitir servir /uploads a otros orígenes
    hsts: env.isProd ? { maxAge: 15552000, includeSubDomains: true } : false,
  });

  // Compresión de respuestas (clave para payloads grandes como miles de boletos).
  await app.register(compress, { global: true, encodings: ['br', 'gzip', 'deflate'], threshold: 1024 });

  // CORS — permite orígenes de la lista y opcionalmente cualquier subdominio del dominio raíz.
  await app.register(cors, {
    credentials: true,
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // peticiones same-origin / curl
      cb(null, isAllowedOrigin(origin));
    },
  });

  await app.register(cookie, { secret: env.cookieSecret });

  await app.register(jwt, {
    secret: env.jwtSecret,
    cookie: { cookieName: SESSION_COOKIE, signed: false },
    sign: { expiresIn: env.jwtExpiresIn },
  });

  await app.register(rateLimit, {
    global: false, // se aplica por-ruta en rutas sensibles (auth, reserve)
    max: 100,
    timeWindow: '1 minute',
  });

  await app.register(multipart, {
    // Tope alto para permitir video; cada endpoint aplica su propio límite por-petición.
    limits: { fileSize: 50 * 1024 * 1024, files: 8 },
    throwFileSizeLimit: false, // no lanza; marca file.truncated para devolver error amigable
  });

  // Servir archivos subidos.
  if (env.storage.driver === 'local') {
    // Modo local (dev): disco + @fastify/static.
    const uploadsRoot = resolve(env.storage.localDir);
    mkdirSync(uploadsRoot, { recursive: true }); // @fastify/static requiere que exista al registrar
    await app.register(fastifyStatic, {
      root: uploadsRoot,
      prefix: '/uploads/',
      decorateReply: false,
    });
    if (env.isProd) {
      // Disco efímero en producción: las imágenes se PERDERÍAN en cada redeploy.
      // No debería pasar (en prod el default es `db`); avisamos fuerte por si acaso.
      app.log.warn(
        '⚠️  ALMACENAMIENTO LOCAL EN PRODUCCIÓN: las imágenes se guardan en disco efímero y se PERDERÁN en cada redeploy. ' +
          'Quita STORAGE_DRIVER (o ponlo en "db") para guardarlas en Postgres.',
      );
    } else {
      app.log.info('Almacenamiento de imágenes: disco local (desarrollo) en ' + uploadsRoot);
    }
  } else if (env.storage.driver === 'db') {
    app.log.info('Almacenamiento de imágenes: Postgres (StoredAsset). Sobreviven a los redeploys. ✅');
    // Modo BD (Railway): las imágenes viven en Postgres y sobreviven a los deploys.
    // Caché agresivo: la `key` es aleatoria, así que el contenido es inmutable.
    app.get('/uploads/*', async (request, reply) => {
      const key = (request.params as Record<string, string>)['*'];
      const asset = await prisma.storedAsset.findUnique({ where: { key } });
      if (!asset) {
        return reply.code(404).send({ error: 'not_found', message: 'Imagen no encontrada' });
      }
      return reply
        .header('Content-Type', asset.mime)
        .header('Cache-Control', 'public, max-age=31536000, immutable')
        .header('Cross-Origin-Resource-Policy', 'cross-origin')
        .send(asset.bytes);
    });
  }

  // Imágenes del demo (logo/portada) empaquetadas en el repo. Se sirven en
  // /demo-assets/ y NO dependen del volumen, así la página de ejemplo siempre
  // tiene sus imágenes tras sembrar (sin necesidad de subir nada al volumen).
  await app.register(fastifyStatic, {
    root: fileURLToPath(new URL('../prisma/demo-assets', import.meta.url)),
    prefix: '/demo-assets/',
    decorateReply: false,
  });

  // Guard CSRF: valida el header Origin en métodos mutantes (defensa en
  // profundidad sobre la cookie de sesión). Corre antes de parsear el body.
  app.addHook('onRequest', csrfGuard);

  // Hook global: intenta autenticar en cada request (no obliga).
  app.addHook('preHandler', authenticate);

  registerErrorHandler(app);

  // Healthcheck
  app.get('/health', async () => ({ ok: true, service: 'bismark-api', ts: new Date().toISOString() }));

  // Módulos de la API bajo /api (mismo origen que el frontend que sirve este
  // mismo proceso). Las rutas OG (/s/...) quedan en raíz porque son enlaces
  // públicos que se comparten por WhatsApp.
  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(riferosRoutes);
      await api.register(rafflesRoutes);
      await api.register(ticketsRoutes);
      await api.register(ordersRoutes);
      await api.register(usersRoutes);
      await api.register(paymentsRoutes);
      await api.register(winnersRoutes);
      await api.register(digitalTicketsRoutes);
      await api.register(reportsRoutes);
      await api.register(uploadsRoutes);
      await api.register(notificationsRoutes);
      await api.register(pushRoutes);
      await api.register(liveRoutes);
      await api.register(publicRoutes);
    },
    { prefix: '/api' },
  );
  await app.register(ogRoutes);

  // ── Frontend (SPA) ─────────────────────────────────────────
  // En producción este mismo servicio sirve el build de apps/web. En desarrollo
  // la carpeta no existe y Vite sirve el frontend con su propio dev server.
  const webDist = process.env.WEB_DIST_DIR
    ? resolve(process.env.WEB_DIST_DIR)
    : fileURLToPath(new URL('../../web/dist', import.meta.url));
  const hasWebDist = existsSync(join(webDist, 'index.html'));
  if (hasWebDist) {
    await app.register(fastifyStatic, {
      root: webDist,
      prefix: '/',
      decorateReply: false,
      wildcard: false,
      // index:false → "/" cae al notFound handler, que sirve el HTML con la marca
      // del rifero inyectada (favicon, título y Open Graph) en vez del estático.
      index: false,
    });
  }

  const rawIndexHtml = hasWebDist ? readFileSync(join(webDist, 'index.html'), 'utf8') : null;
  app.setNotFoundHandler(async (request, reply) => {
    const isApiPath =
      request.url.startsWith('/api/') ||
      request.url.startsWith('/uploads/') ||
      request.url.startsWith('/demo-assets/') ||
      request.url.startsWith('/s/');
    if (rawIndexHtml && request.method === 'GET' && !isApiPath) {
      // Fallback SPA: cualquier ruta del frontend devuelve el index.html con la
      // marca del rifero del sitio (logo, nombre y vista previa al compartir).
      const html = await renderBrandedIndex(rawIndexHtml, request);
      return reply.type('text/html; charset=utf-8').header('Cache-Control', 'no-cache').send(html);
    }
    return reply
      .code(404)
      .send({ error: 'not_found', message: `Ruta no encontrada: ${request.method} ${request.url}` });
  });

  return app;
}

export const STATIC_ROOT = join(process.cwd(), 'uploads');
