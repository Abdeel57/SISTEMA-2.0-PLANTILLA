import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

// Carga de variables de entorno. Prioridad (de mayor a menor):
//   1. Variables ya presentes en el proceso (las que inyecta Railway / el SO).
//   2. .env             — overrides locales (NO versionado; solo desarrollo).
//   3. .env.production  — valores NO secretos versionados en el repo (solo prod).
// dotenv nunca sobreescribe una variable ya definida, así que el dashboard de
// Railway siempre gana y los secretos viven únicamente ahí.
loadEnv();

// Detección ROBUSTA de producción. Railway SIEMPRE inyecta RAILWAY_ENVIRONMENT (y
// RAILWAY_PROJECT_ID), así que no dependemos de que alguien recuerde poner
// NODE_ENV=production a mano. Si detectamos Railway, normalizamos NODE_ENV para
// que TODO el proceso (logger, cookies seguras, almacenamiento en BD) se comporte
// como producción. Esto evita el caso peligroso de caer a almacenamiento local
// (disco efímero) y perder las imágenes en cada redeploy.
const onRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID);
if (onRailway && process.env.NODE_ENV !== 'production') {
  process.env.NODE_ENV = 'production';
}
if (process.env.NODE_ENV === 'production') {
  loadEnv({ path: fileURLToPath(new URL('../../.env.production', import.meta.url)) });
}

// Respaldo ESTABLE para los secretos de sesión cuando no se definieron como
// variables en Railway. Se derivan de DATABASE_URL —que Railway mantiene fijo
// entre redeploys— así que las sesiones NO se invalidan al volver a desplegar y
// el deploy funciona con CERO configuración extra (solo DATABASE_URL).
// Recomendado para mayor seguridad: definir JWT_SECRET y COOKIE_SECRET propios en
// Railway (tienen prioridad sobre este respaldo).
function derivedSecret(purpose: string): string {
  const base = process.env.DATABASE_URL ?? 'bismark-local-dev';
  return createHash('sha256').update(`bismark:${purpose}:${base}`).digest('hex');
}

function str(key: string, fallback?: string): string {
  const v = process.env[key];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`Falta variable de entorno requerida: ${key}`);
  }
  return v;
}

function bool(key: string, fallback = false): boolean {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return v === 'true' || v === '1';
}

function num(key: string, fallback: number): number {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

const isProd = process.env.NODE_ENV === 'production';

export const env = {
  isProd,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: num('PORT', 4000),
  host: str('HOST', '0.0.0.0'),

  databaseUrl: str('DATABASE_URL'),

  jwtSecret: str('JWT_SECRET', isProd ? derivedSecret('jwt') : 'dev-insecure-jwt-secret-change-me-please-32'),
  cookieSecret: str('COOKIE_SECRET', isProd ? derivedSecret('cookie') : 'dev-insecure-cookie-secret-change-me-32chars'),
  jwtExpiresIn: str('JWT_EXPIRES_IN', '7d'),
  cookieSecure: bool('COOKIE_SECURE', isProd),
  cookieSameSite: (process.env.COOKIE_SAME_SITE ?? 'lax') as 'lax' | 'strict' | 'none',
  cookieDomain: process.env.COOKIE_DOMAIN || undefined,

  corsOrigins: str('CORS_ORIGINS', 'http://localhost:5173,http://localhost:4173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  corsRootDomain: process.env.CORS_ROOT_DOMAIN || '',

  // URL pública del sitio. Vacía = se infiere del host de cada petición
  // (frontend y API comparten origen en producción).
  publicWebUrl: (process.env.PUBLIC_WEB_URL ?? '').replace(/\/$/, ''),

  // URL pública de la propia API (para construir enlaces absolutos: OG, imágenes locales).
  // Si no se define, se infiere host:port en runtime al construir cada enlace.
  publicApiUrl: process.env.PUBLIC_API_URL?.replace(/\/$/, '') || '',

  // Envío de correos. Driver `log` (dev: imprime el correo en consola) o `resend`.
  // Por defecto usa resend si hay API key, de lo contrario log (no rompe en local).
  email: {
    driver: (process.env.EMAIL_DRIVER || (process.env.RESEND_API_KEY ? 'resend' : 'log')) as
      | 'log'
      | 'resend',
    from: str('EMAIL_FROM', 'Bismark <onboarding@resend.dev>'),
    replyTo: process.env.EMAIL_REPLY_TO || undefined,
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    // Minutos de validez del enlace de recuperación de contraseña.
    passwordResetTtlMin: num('PASSWORD_RESET_TTL_MIN', 60),
  },

  // Monitoreo de errores (opcional). Sin DSN, no se inicializa nada.
  sentryDsn: process.env.SENTRY_DSN || '',
  sentryTracesSampleRate: num('SENTRY_TRACES_SAMPLE_RATE', 0),

  // Web Push (avisos al rifero). Sin claves VAPID, el push queda desactivado (no-op).
  // Genera claves con: npx web-push generate-vapid-keys
  push: {
    vapidPublic: process.env.VAPID_PUBLIC_KEY || '',
    vapidPrivate: process.env.VAPID_PRIVATE_KEY || '',
    vapidSubject: process.env.VAPID_SUBJECT || 'mailto:soporte@bismark.com',
  },

  storage: {
    // En producción el default es `db`: las imágenes viven en Postgres y
    // SOBREVIVEN a los redeploys de Railway sin depender de un Volume. En local el
    // default es `local` (disco). Se puede forzar con STORAGE_DRIVER.
    driver: (process.env.STORAGE_DRIVER ?? (isProd ? 'db' : 'local')) as 'local' | 'db' | 'cloudinary' | 's3',
    localDir: str('LOCAL_UPLOAD_DIR', './uploads'),
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
      apiKey: process.env.CLOUDINARY_API_KEY ?? '',
      apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
      folder: process.env.CLOUDINARY_FOLDER ?? 'bismark',
    },
    s3: {
      endpoint: process.env.S3_ENDPOINT ?? '',
      region: process.env.S3_REGION ?? 'auto',
      bucket: process.env.S3_BUCKET ?? '',
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
      publicBaseUrl: process.env.S3_PUBLIC_BASE_URL ?? '',
    },
  },

} as const;

export type Env = typeof env;
