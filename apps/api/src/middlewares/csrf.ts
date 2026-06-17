import type { FastifyReply, FastifyRequest } from 'fastify';
import { isAllowedOrigin } from '../lib/origins.js';
import { forbidden } from '../lib/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

// Protección CSRF basada en el header Origin (defensa en profundidad sobre la
// cookie de sesión). Un navegador SIEMPRE adjunta Origin en peticiones mutantes
// cross-site; un sitio malicioso no puede falsificarlo ni omitirlo. Por tanto:
//   - Métodos seguros (GET/HEAD/OPTIONS): se permiten.
//   - Con Origin: debe estar en la allowlist; si no, 403.
//   - Sin Origin pero con Referer: validamos el origen del Referer.
//   - Sin Origin ni Referer: cliente no-navegador (app móvil/curl) → se permite
//     (no hay cookie de navegador que explotar).
export function csrfGuard(request: FastifyRequest, _reply: FastifyReply, done: (err?: Error) => void): void {
  if (SAFE_METHODS.has(request.method)) return done();

  // El frontend lo sirve este mismo proceso: el origen propio siempre es válido.
  const selfOrigin = request.headers.host ? `${request.protocol}://${request.headers.host}` : null;
  const allowed = (origin: string) => origin === selfOrigin || isAllowedOrigin(origin);

  const origin = request.headers.origin;
  if (origin) {
    if (!allowed(origin)) return done(forbidden('Origen no permitido'));
    return done();
  }

  const referer = request.headers.referer;
  if (referer) {
    try {
      if (!allowed(new URL(referer).origin)) return done(forbidden('Origen no permitido'));
    } catch {
      return done(forbidden('Origen no permitido'));
    }
  }

  done();
}
