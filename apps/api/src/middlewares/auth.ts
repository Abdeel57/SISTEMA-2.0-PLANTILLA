import type { FastifyReply, FastifyRequest } from 'fastify';
import { unauthorized, forbidden } from '../lib/errors.js';
import type { UserRole } from '@bismark/shared';

// preHandler: intenta verificar el JWT (cookie o Bearer) y poblar request.auth.
// No falla si no hay token (rutas mixtas público/privado lo manejan con requireAuth).
export async function authenticate(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    const payload = await request.jwtVerify<{ sub: string; role: UserRole; riferoId?: string | null }>();
    request.auth = {
      userId: payload.sub,
      role: payload.role,
      riferoId: payload.riferoId ?? null,
    };
  } catch {
    request.auth = undefined;
  }
}

export function requireAuth(request: FastifyRequest, _reply: FastifyReply, done: (err?: Error) => void): void {
  if (!request.auth) {
    done(unauthorized());
    return;
  }
  done();
}

export function requireRole(...roles: UserRole[]) {
  return function (request: FastifyRequest, _reply: FastifyReply, done: (err?: Error) => void): void {
    if (!request.auth) {
      done(unauthorized());
      return;
    }
    if (!roles.includes(request.auth.role)) {
      done(forbidden('No tienes permisos para esta acción'));
      return;
    }
    done();
  };
}

// Requiere ser ADMINISTRADOR del rifero (dueño o admin extra). Garantiza
// request.auth.riferoId presente. NOTA: bloquea a los vendedores (SELLER), por
// eso protege por defecto TODAS las rutas de administración que ya lo usan.
export function requireRifero(request: FastifyRequest, _reply: FastifyReply, done: (err?: Error) => void): void {
  if (!request.auth) {
    done(unauthorized());
    return;
  }
  if (request.auth.role !== 'RIFERO' && request.auth.role !== 'SUPER_ADMIN') {
    done(forbidden('Solo administradores pueden acceder'));
    return;
  }
  if (!request.auth.riferoId) {
    done(forbidden('Completa tu perfil de rifero primero'));
    return;
  }
  done();
}

// Requiere pertenecer al rifero como STAFF: administrador (RIFERO/SUPER_ADMIN) o
// vendedor (SELLER). Se usa SOLO en endpoints que el vendedor puede tocar; cada
// ruta debe además acotar por sellerId cuando el rol es SELLER.
export function requireStaff(request: FastifyRequest, _reply: FastifyReply, done: (err?: Error) => void): void {
  if (!request.auth) {
    done(unauthorized());
    return;
  }
  const { role, riferoId } = request.auth;
  if (role !== 'RIFERO' && role !== 'SUPER_ADMIN' && role !== 'SELLER') {
    done(forbidden('No tienes acceso al panel'));
    return;
  }
  if (!riferoId) {
    done(forbidden('Tu cuenta no está vinculada a un rifero'));
    return;
  }
  done();
}

export const requireAdmin = requireRole('SUPER_ADMIN');
