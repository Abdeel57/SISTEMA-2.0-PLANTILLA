import type { FastifyInstance } from 'fastify';
import { updateRiferoSchema } from '@bismark/shared';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../lib/http.js';
import { notFound, badRequest } from '../../lib/errors.js';
import { requireRifero } from '../../middlewares/auth.js';
import { getPlanContext } from '../../lib/plan.js';
import { toRiferoProfileDTO } from '../../lib/serializers.js';
import { logActivity } from '../../lib/activity.js';

async function profileResponse(riferoId: string) {
  const profile = await prisma.riferoProfile.findUnique({ where: { id: riferoId } });
  if (!profile) throw notFound('Perfil no encontrado');
  const ctx = await getPlanContext(riferoId);
  return toRiferoProfileDTO(profile, ctx);
}

// El perfil del rifero lo crea el seed al desplegar cada copia del sitio;
// ya no existe registro público ni onboarding.
export default async function riferosRoutes(app: FastifyInstance): Promise<void> {
  // GET /riferos/me
  app.get('/riferos/me', { preHandler: requireRifero }, async (request) => {
    return { profile: await profileResponse(request.auth!.riferoId!) };
  });

  // PATCH /riferos/me
  app.patch('/riferos/me', { preHandler: requireRifero }, async (request) => {
    const riferoId = request.auth!.riferoId!;
    const data = validate(updateRiferoSchema, request.body);

    // No se permite cambiar slug/subdominio desde aquí (estabilidad de URLs públicas).
    if ('slug' in (request.body as object) || 'subdomain' in (request.body as object)) {
      throw badRequest('El subdominio no puede cambiarse desde aquí');
    }

    const cleaned = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, v === '' ? null : v]),
    );

    await prisma.riferoProfile.update({ where: { id: riferoId }, data: cleaned });
    await logActivity({ userId: request.auth!.userId, type: 'RAFFLE', action: 'update_profile' });
    return { profile: await profileResponse(riferoId) };
  });
}
