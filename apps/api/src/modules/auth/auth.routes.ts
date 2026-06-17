import type { FastifyInstance } from 'fastify';
import { loginSchema } from '@bismark/shared';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../lib/http.js';
import { verifyPassword } from '../../lib/auth.js';
import { unauthorized, forbidden } from '../../lib/errors.js';
import { setSession, clearSession } from '../../lib/session.js';
import { toAuthUserDTO } from '../../lib/serializers.js';
import { logActivity } from '../../lib/activity.js';

export default async function authRoutes(app: FastifyInstance): Promise<void> {
  // Limitar intentos en endpoints sensibles.
  const authLimit = { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } };

  // POST /auth/login — acceso del administrador del sitio (usuario + contraseña).
  // El "usuario" se guarda en la columna email (en minúsculas) para no tocar el esquema.
  app.post('/auth/login', authLimit, async (request, reply) => {
    const data = validate(loginSchema, request.body);

    const user = await prisma.user.findUnique({
      where: { email: data.usuario.trim().toLowerCase() },
      include: { riferoProfile: true },
    });
    if (!user) throw unauthorized('Usuario o contraseña incorrectos');
    if (user.status === 'SUSPENDED') throw forbidden('Tu cuenta está suspendida. Contacta a soporte.');
    if (user.status === 'DELETED') throw unauthorized('Usuario o contraseña incorrectos');

    const ok = await verifyPassword(data.password, user.passwordHash);
    if (!ok) throw unauthorized('Usuario o contraseña incorrectos');

    await logActivity({ userId: user.id, type: 'AUTH', action: 'login', ip: request.ip });
    // El token también viaja en el body: fallback Bearer para navegadores que
    // bloquean cookies (Safari/iOS). El dueño deriva su rifero del perfil; el
    // staff (admins extra y vendedores), de su membresía.
    const riferoId = user.riferoProfile?.id ?? user.memberOfRiferoId ?? null;
    const token = await setSession(reply, { sub: user.id, role: user.role, riferoId });

    return reply.send({ user: toAuthUserDTO(user, user.riferoProfile), token });
  });

  // POST /auth/logout
  app.post('/auth/logout', async (_request, reply) => {
    clearSession(reply);
    return reply.send({ ok: true });
  });

  // GET /auth/me — auth "suave": responde 200 con user:null cuando no hay sesión,
  // en vez de 401. Así no ensucia la consola con un 401 en cada página pública.
  app.get('/auth/me', async (request, reply) => {
    if (!request.auth) {
      return reply.send({ user: null });
    }
    const user = await prisma.user.findUnique({
      where: { id: request.auth.userId },
      include: { riferoProfile: true },
    });
    return reply.send({ user: user ? toAuthUserDTO(user, user.riferoProfile) : null });
  });
}
