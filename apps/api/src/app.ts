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
import { mkdirSync } from 'node:fs';
import { env } from './config/env.js';
import { SESSION_COOKIE } from './lib/auth.js';
import { isAllowedOrigin } from './lib/origins.js';
import { authenticate } from './middlewares/auth.js';
import { csrfGuard } from './middlewares/csrf.js';
import { registerErrorHandler } from './middlewares/error-handler.js';

// Módulos de rutas
import authRoutes from './modules/auth/auth.routes.js';
import riferosRoutes from './modules/riferos/riferos.routes.js';
import rafflesRoutes from './modules/raffles/raffles.routes.js';
import ticketsRoutes from './modules/tickets/tickets.routes.js';
import ordersRoutes from './modules/orders/orders.routes.js';
import paymentsRoutes from './modules/payments/payments.routes.js';
import winnersRoutes from './modules/winners/winners.routes.js';
import plansRoutes from './modules/plans/plans.routes.js';
import subscriptionsRoutes from './modules/subscriptions/subscriptions.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
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

  // Servir archivos subidos en modo local (dev).
  if (env.storage.driver === 'local') {
    const uploadsRoot = resolve(env.storage.localDir);
    mkdirSync(uploadsRoot, { recursive: true }); // @fastify/static requiere que exista al registrar
    await app.register(fastifyStatic, {
      root: uploadsRoot,
      prefix: '/uploads/',
      decorateReply: false,
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

  // Cada módulo declara rutas absolutas (ver spec de endpoints). Se montan en raíz.
  await app.register(authRoutes);
  await app.register(riferosRoutes);
  await app.register(rafflesRoutes);
  await app.register(ticketsRoutes);
  await app.register(ordersRoutes);
  await app.register(paymentsRoutes);
  await app.register(winnersRoutes);
  await app.register(plansRoutes);
  await app.register(subscriptionsRoutes);
  await app.register(adminRoutes);
  await app.register(digitalTicketsRoutes);
  await app.register(reportsRoutes);
  await app.register(uploadsRoutes);
  await app.register(notificationsRoutes);
  await app.register(ogRoutes);
  await app.register(pushRoutes);
  await app.register(liveRoutes);
  await app.register(publicRoutes);

  return app;
}

export const STATIC_ROOT = join(process.cwd(), 'uploads');
