import type { FastifyInstance } from 'fastify';
import { createPanelUserSchema, updatePanelUserSchema, type PanelUserDTO } from '@bismark/shared';
import type { User } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../lib/http.js';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js';
import { requireRifero, requireStaff } from '../../middlewares/auth.js';
import { hashPassword } from '../../lib/auth.js';
import { newTempPassword, nextSellerCode } from '../../lib/codes.js';
import { getSellerStats } from '../../lib/sellerStats.js';
import { logActivity } from '../../lib/activity.js';

// Mapea un usuario de staff a su DTO. Incluye métricas si es vendedor.
async function toPanelUserDTO(user: User, ownerUserId: string): Promise<PanelUserDTO> {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role,
    status: user.status,
    isOwner: user.id === ownerUserId,
    sellerCode: user.sellerCode ?? null,
    createdAt: user.createdAt.toISOString(),
    stats: user.role === 'SELLER' ? await getSellerStats(user.id) : null,
  };
}

// Códigos de vendedor ya usados en este rifero (para autogenerar el siguiente).
async function existingSellerCodes(riferoId: string): Promise<string[]> {
  const rows = await prisma.user.findMany({
    where: { memberOfRiferoId: riferoId, sellerCode: { not: null } },
    select: { sellerCode: true },
  });
  return rows.map((r) => r.sellerCode!).filter(Boolean);
}

// Genera un código de vendedor único (reintenta ante colisión global del unique).
async function generateUniqueSellerCode(riferoId: string): Promise<string> {
  const used = await existingSellerCodes(riferoId);
  for (let i = 0; i < 50; i++) {
    const candidate = nextSellerCode(used);
    const clash = await prisma.user.findUnique({ where: { sellerCode: candidate } });
    if (!clash) return candidate;
    used.push(candidate);
  }
  throw conflict('No se pudo generar un código de vendedor único, intenta de nuevo');
}

export default async function usersRoutes(app: FastifyInstance): Promise<void> {
  // Carga el usuario dueño del rifero (para marcar isOwner y protegerlo).
  async function ownerUserId(riferoId: string): Promise<string> {
    const profile = await prisma.riferoProfile.findUniqueOrThrow({
      where: { id: riferoId },
      select: { userId: true },
    });
    return profile.userId;
  }

  // GET /seller/me/stats — métricas del propio vendedor (para su panel).
  app.get('/seller/me/stats', { preHandler: requireStaff }, async (request) => {
    return { stats: await getSellerStats(request.auth!.userId) };
  });

  // GET /users — lista de staff del rifero (administradores + vendedores).
  app.get('/users', { preHandler: requireRifero }, async (request) => {
    const riferoId = request.auth!.riferoId!;
    const ownerId = await ownerUserId(riferoId);

    // El dueño + todos los miembros (admins extra y vendedores) de este rifero.
    const users = await prisma.user.findMany({
      where: {
        status: { not: 'DELETED' },
        OR: [{ id: ownerId }, { memberOfRiferoId: riferoId }],
      },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });

    const items = await Promise.all(users.map((u) => toPanelUserDTO(u, ownerId)));
    return { items };
  });

  // POST /users — crear administrador o vendedor.
  app.post('/users', { preHandler: requireRifero }, async (request, reply) => {
    const riferoId = request.auth!.riferoId!;
    const data = validate(createPanelUserSchema, request.body);

    const email = data.email.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw conflict('Ya existe un usuario con ese correo o nombre de usuario');

    // Contraseña: la provista o una temporal que se muestra una sola vez.
    const tempPassword = data.password && data.password.trim() ? null : newTempPassword();
    const plainPassword = data.password && data.password.trim() ? data.password.trim() : tempPassword!;
    const passwordHash = await hashPassword(plainPassword);

    // Código de vendedor (solo SELLER): el provisto (único) o autogenerado.
    let sellerCode: string | null = null;
    if (data.role === 'SELLER') {
      if (data.sellerCode && data.sellerCode.trim()) {
        const code = data.sellerCode.trim().toUpperCase();
        const clash = await prisma.user.findUnique({ where: { sellerCode: code } });
        if (clash) throw conflict('Ese código de vendedor ya está en uso');
        sellerCode = code;
      } else {
        sellerCode = await generateUniqueSellerCode(riferoId);
      }
    }

    const user = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email,
        phone: data.phone?.trim() || null,
        passwordHash,
        role: data.role,
        status: 'ACTIVE',
        memberOfRiferoId: riferoId,
        sellerCode,
      },
    });

    await logActivity({
      userId: request.auth!.userId,
      type: 'ADMIN',
      action: 'create_user',
      meta: { userId: user.id, role: user.role },
    });

    const dto = await toPanelUserDTO(user, await ownerUserId(riferoId));
    // tempPassword solo se devuelve aquí, una vez, para que el admin lo comparta.
    return reply.code(201).send({ user: dto, tempPassword });
  });

  // PATCH /users/:id — editar (rol, estado, datos, contraseña, código).
  app.patch('/users/:id', { preHandler: requireRifero }, async (request) => {
    const { id } = request.params as { id: string };
    const riferoId = request.auth!.riferoId!;
    const data = validate(updatePanelUserSchema, request.body);

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || target.status === 'DELETED') throw notFound('Usuario no encontrado');

    const ownerId = await ownerUserId(riferoId);
    const isOwner = target.id === ownerId;
    const belongs = isOwner || target.memberOfRiferoId === riferoId;
    if (!belongs || target.role === 'SUPER_ADMIN') throw forbidden('Este usuario no pertenece a tu panel');

    // Protecciones: el dueño no se degrada ni desactiva; nadie se edita el
    // propio rol/estado (evita auto-bloqueo).
    const editingSelf = target.id === request.auth!.userId;
    if ((data.role !== undefined || data.status !== undefined) && (isOwner || editingSelf)) {
      throw forbidden('No puedes cambiar el rol o estado de tu propia cuenta ni del dueño');
    }

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name.trim();
    if (data.phone !== undefined) patch.phone = data.phone.trim() || null;
    if (data.password && data.password.trim()) patch.passwordHash = await hashPassword(data.password.trim());
    if (data.status !== undefined) patch.status = data.status;

    // Rol y código de vendedor van de la mano.
    const nextRole = data.role ?? target.role;
    if (data.role !== undefined) patch.role = data.role;

    if (nextRole === 'SELLER') {
      if (data.sellerCode && data.sellerCode.trim()) {
        const code = data.sellerCode.trim().toUpperCase();
        const clash = await prisma.user.findUnique({ where: { sellerCode: code } });
        if (clash && clash.id !== target.id) throw conflict('Ese código de vendedor ya está en uso');
        patch.sellerCode = code;
      } else if (!target.sellerCode) {
        patch.sellerCode = await generateUniqueSellerCode(riferoId);
      }
    } else if (nextRole === 'RIFERO') {
      // Un administrador no usa código de vendedor.
      patch.sellerCode = null;
    }

    if (Object.keys(patch).length === 0) throw badRequest('Nada que actualizar');

    const updated = await prisma.user.update({ where: { id }, data: patch });
    await logActivity({
      userId: request.auth!.userId,
      type: 'ADMIN',
      action: 'update_user',
      meta: { userId: id, changes: Object.keys(patch) },
    });

    const dto = await toPanelUserDTO(updated, ownerId);
    return { user: dto };
  });
}
