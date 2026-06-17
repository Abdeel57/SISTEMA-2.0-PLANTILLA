import type { FastifyInstance } from 'fastify';
import { Prisma } from '@prisma/client';
import { createRaffleSchema, updateRaffleSchema, slugify } from '@bismark/shared';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../lib/http.js';
import { badRequest, conflict } from '../../lib/errors.js';
import { requireRifero } from '../../middlewares/auth.js';
import { loadOwnedRaffle } from '../../lib/ownership.js';
import { assertCanPublishRaffle } from '../../lib/plan.js';
import { generateAllTickets, hasCommittedTickets } from '../../lib/tickets.js';
import { getRaffleStats } from '../../lib/stats.js';
import { toRaffleDTO } from '../../lib/serializers.js';
import { logActivity } from '../../lib/activity.js';

function parseDate(v?: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function raffleDTO(raffleId: string) {
  const raffle = await prisma.raffle.findUniqueOrThrow({
    where: { id: raffleId },
    include: { images: { orderBy: { sortOrder: 'asc' } } },
  });
  const stats = await getRaffleStats(raffleId, raffle.totalTickets);
  return toRaffleDTO(raffle, raffle.images, stats);
}

export default async function rafflesRoutes(app: FastifyInstance): Promise<void> {
  // GET /dashboard/summary — resumen para el panel del rifero
  app.get('/dashboard/summary', { preHandler: requireRifero }, async (request) => {
    const riferoId = request.auth!.riferoId!;
    const raffleIds = (await prisma.raffle.findMany({ where: { riferoId }, select: { id: true } })).map((r) => r.id);

    const [pendingOrders, paidOrders, totalOrders, activeRaffles, upcomingDraws, ticketAgg, paidTickets] =
      await Promise.all([
        prisma.order.count({ where: { raffle: { riferoId }, status: { in: ['RESERVED', 'PENDING'] } } }),
        prisma.order.count({ where: { raffle: { riferoId }, status: 'PAID' } }),
        prisma.order.count({ where: { raffle: { riferoId } } }),
        prisma.raffle.count({ where: { riferoId, status: 'PUBLISHED' } }),
        prisma.raffle.count({ where: { riferoId, status: 'PUBLISHED', drawDate: { gte: new Date() } } }),
        prisma.ticketNumber.count({ where: { raffleId: { in: raffleIds }, status: 'RESERVED' } }),
        prisma.ticketNumber.findMany({
          where: { raffleId: { in: raffleIds }, status: 'PAID' },
          select: { raffle: { select: { ticketPrice: true } } },
        }),
      ]);

    const soldTickets = paidTickets.length;
    const estimatedRevenue = paidTickets.reduce((sum, t) => sum + (t.raffle?.ticketPrice ?? 0), 0);

    return {
      summary: {
        pendingOrders,
        paidOrders,
        totalOrders,
        activeRaffles,
        upcomingDraws,
        soldTickets,
        reservedTickets: ticketAgg,
        estimatedRevenue,
      },
    };
  });

  // GET /raffles — lista de rifas del rifero
  app.get('/raffles', { preHandler: requireRifero }, async (request) => {
    const riferoId = request.auth!.riferoId!;
    const raffles = await prisma.raffle.findMany({
      where: { riferoId },
      orderBy: { eventNumber: 'desc' },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });
    const items = await Promise.all(
      raffles.map(async (r) => toRaffleDTO(r, r.images, await getRaffleStats(r.id, r.totalTickets))),
    );
    return { items };
  });

  // POST /raffles — crear rifa (requiere plan activo y cupo)
  app.post('/raffles', { preHandler: requireRifero }, async (request, reply) => {
    const riferoId = request.auth!.riferoId!;
    const data = validate(createRaffleSchema, request.body);

    // Crear y personalizar rifas NO requiere plan: el rifero prepara todo en
    // privado. El plan sólo se exige al publicar (hacer pública la página).
    const ticketStart = data.ticketStart ?? 1;
    const ticketEnd = ticketStart + data.totalTickets - 1;

    // Número de evento consecutivo por rifero.
    const last = await prisma.raffle.findFirst({
      where: { riferoId },
      orderBy: { eventNumber: 'desc' },
      select: { eventNumber: true },
    });
    const eventNumber = (last?.eventNumber ?? 0) + 1;

    const profile = await prisma.riferoProfile.findUniqueOrThrow({ where: { id: riferoId } });

    const raffle = await prisma.raffle.create({
      data: {
        riferoId,
        eventNumber,
        title: data.title,
        slug: slugify(data.title) || `rifa-${eventNumber}`,
        description: data.description ?? null,
        prize: data.prize ?? null,
        ticketPrice: data.ticketPrice,
        totalTickets: data.totalTickets,
        ticketFormat: data.ticketFormat ?? 3,
        ticketStart,
        ticketEnd,
        maxTicketsPerOrder: data.maxTicketsPerOrder ?? null,
        startDate: parseDate(data.startDate || undefined),
        endDate: parseDate(data.endDate || undefined),
        drawDate: parseDate(data.drawDate || undefined),
        terms: data.terms ?? null,
        paymentInstructions: data.paymentInstructions ?? profile.payInstructions ?? null,
        reserveMinutes: data.reserveMinutes ?? profile.defaultReserveMinutes,
        allowWinnerPublication: data.allowWinnerPublication ?? true,
        useDigitalDraw: data.useDigitalDraw ?? false,
        showCountdown: data.showCountdown ?? true,
        opportunities: data.opportunities ?? 1,
        pricingTiers: (data.pricingTiers ?? []) as unknown as Prisma.InputJsonValue,
        pricingBundles: (data.pricingBundles ?? []) as unknown as Prisma.InputJsonValue,
        status: 'DRAFT',
        images: data.images?.length
          ? { create: data.images.map((url, i) => ({ url, sortOrder: i })) }
          : undefined,
      },
    });

    await generateAllTickets(raffle.id, ticketStart, data.totalTickets, data.ticketFormat ?? 3, data.opportunities ?? 1);
    await logActivity({
      userId: request.auth!.userId,
      type: 'RAFFLE',
      action: 'create_raffle',
      meta: { raffleId: raffle.id, eventNumber },
    });

    return reply.code(201).send({ raffle: await raffleDTO(raffle.id) });
  });

  // GET /raffles/:id
  app.get('/raffles/:id', { preHandler: requireRifero }, async (request) => {
    const { id } = request.params as { id: string };
    await loadOwnedRaffle(id, request.auth!);
    return { raffle: await raffleDTO(id) };
  });

  // PATCH /raffles/:id
  app.patch('/raffles/:id', { preHandler: requireRifero }, async (request) => {
    const { id } = request.params as { id: string };
    const raffle = await loadOwnedRaffle(id, request.auth!);
    const data = validate(updateRaffleSchema, request.body);

    const opportunitiesChange =
      data.opportunities !== undefined && data.opportunities !== raffle.opportunities;
    const structuralChange =
      (data.totalTickets !== undefined && data.totalTickets !== raffle.totalTickets) ||
      (data.ticketStart !== undefined && data.ticketStart !== raffle.ticketStart) ||
      (data.ticketFormat !== undefined && data.ticketFormat !== raffle.ticketFormat) ||
      opportunitiesChange;

    if (structuralChange) {
      if (await hasCommittedTickets(id)) {
        // Mensaje específico para oportunidades (Opción A: bloqueo si ya hay ventas).
        if (opportunitiesChange) {
          throw conflict('No puedes modificar las oportunidades porque esta rifa ya tiene órdenes generadas.');
        }
        throw conflict('No puedes cambiar la numeración: ya hay boletos apartados o pagados.');
      }
      // Editar borradores es libre (sin plan). El límite de boletos del plan se
      // valida al publicar.
      const newTotal = data.totalTickets ?? raffle.totalTickets;
      const newStart = data.ticketStart ?? raffle.ticketStart;
      const newFormat = data.ticketFormat ?? raffle.ticketFormat;
      const newOpportunities = data.opportunities ?? raffle.opportunities;
      // Regenerar boletos desde cero (manuales + regalos). Sólo DRAFT sin compromisos.
      await prisma.ticketNumber.deleteMany({ where: { raffleId: id } });
      await generateAllTickets(id, newStart, newTotal, newFormat, newOpportunities);
      await prisma.raffle.update({
        where: { id },
        data: { ticketEnd: newStart + newTotal - 1, opportunities: newOpportunities },
      });
    }

    if ('images' in data) {
      const images = (data as { images?: string[] }).images;
      if (images) {
        await prisma.raffleImage.deleteMany({ where: { raffleId: id } });
        if (images.length) {
          await prisma.raffleImage.createMany({
            data: images.map((url, i) => ({ raffleId: id, url, sortOrder: i })),
          });
        }
      }
    }

    const { images: _img, ...rest } = data as Record<string, unknown>;
    await prisma.raffle.update({
      where: { id },
      data: {
        ...(rest.title !== undefined ? { title: rest.title as string, slug: slugify(rest.title as string) } : {}),
        ...(rest.description !== undefined ? { description: (rest.description as string) || null } : {}),
        ...(rest.prize !== undefined ? { prize: (rest.prize as string) || null } : {}),
        ...(rest.ticketPrice !== undefined ? { ticketPrice: rest.ticketPrice as number } : {}),
        ...(rest.maxTicketsPerOrder !== undefined ? { maxTicketsPerOrder: (rest.maxTicketsPerOrder as number) ?? null } : {}),
        ...(rest.startDate !== undefined ? { startDate: parseDate(rest.startDate as string) } : {}),
        ...(rest.endDate !== undefined ? { endDate: parseDate(rest.endDate as string) } : {}),
        ...(rest.drawDate !== undefined ? { drawDate: parseDate(rest.drawDate as string) } : {}),
        ...(rest.terms !== undefined ? { terms: (rest.terms as string) || null } : {}),
        ...(rest.paymentInstructions !== undefined ? { paymentInstructions: (rest.paymentInstructions as string) || null } : {}),
        ...(rest.reserveMinutes !== undefined ? { reserveMinutes: rest.reserveMinutes as number } : {}),
        ...(rest.allowWinnerPublication !== undefined ? { allowWinnerPublication: rest.allowWinnerPublication as boolean } : {}),
        ...(rest.useDigitalDraw !== undefined ? { useDigitalDraw: rest.useDigitalDraw as boolean } : {}),
        ...(rest.showCountdown !== undefined ? { showCountdown: rest.showCountdown as boolean } : {}),
        ...(rest.pricingTiers !== undefined ? { pricingTiers: rest.pricingTiers as Prisma.InputJsonValue } : {}),
        ...(rest.pricingBundles !== undefined ? { pricingBundles: rest.pricingBundles as Prisma.InputJsonValue } : {}),
        ...(rest.promoEnabled !== undefined ? { promoEnabled: rest.promoEnabled as boolean } : {}),
        ...(rest.promoTitle !== undefined ? { promoTitle: (rest.promoTitle as string) || null } : {}),
        ...(rest.promoSubtitle !== undefined ? { promoSubtitle: (rest.promoSubtitle as string) || null } : {}),
        ...(rest.promoColorFrom !== undefined ? { promoColorFrom: (rest.promoColorFrom as string) || null } : {}),
        ...(rest.promoColorTo !== undefined ? { promoColorTo: (rest.promoColorTo as string) || null } : {}),
      },
    });

    return { raffle: await raffleDTO(id) };
  });

  // POST /raffles/:id/publish — requiere plan activo
  app.post('/raffles/:id/publish', { preHandler: requireRifero }, async (request) => {
    const { id } = request.params as { id: string };
    const raffle = await loadOwnedRaffle(id, request.auth!);
    // Publicar = hacer pública la página. Requiere plan activo y respeta sus
    // límites (boletos por rifa y nº de rifas públicas a la vez).
    await assertCanPublishRaffle(raffle.riferoId, id, raffle.totalTickets);

    if (raffle.status === 'FINISHED' || raffle.status === 'CANCELLED') {
      throw badRequest('Esta rifa ya no puede publicarse');
    }

    await prisma.raffle.update({ where: { id }, data: { status: 'PUBLISHED' } });
    // Activa el perfil al publicar la primera rifa.
    await prisma.riferoProfile.updateMany({
      where: { id: raffle.riferoId, status: 'PENDING' },
      data: { status: 'ACTIVE' },
    });
    await logActivity({ userId: request.auth!.userId, type: 'RAFFLE', action: 'publish_raffle', meta: { raffleId: id } });
    return { raffle: await raffleDTO(id) };
  });

  // POST /raffles/:id/cancel
  app.post('/raffles/:id/cancel', { preHandler: requireRifero }, async (request) => {
    const { id } = request.params as { id: string };
    await loadOwnedRaffle(id, request.auth!);
    await prisma.raffle.update({ where: { id }, data: { status: 'CANCELLED' } });
    return { raffle: await raffleDTO(id) };
  });

  // DELETE /raffles/:id — eliminar una rifa por completo (boletos, órdenes,
  // imágenes y promociones se borran en cascada). Protegido: una rifa con pagos
  // confirmados NO se borra (conserva el historial de dinero real); para esos
  // casos el rifero debe usar "Cancelar".
  app.delete('/raffles/:id', { preHandler: requireRifero }, async (request) => {
    const { id } = request.params as { id: string };
    await loadOwnedRaffle(id, request.auth!);

    const paidCount = await prisma.order.count({ where: { raffleId: id, status: 'PAID' } });
    if (paidCount > 0) {
      throw conflict(
        'No puedes eliminar una rifa con pagos confirmados. Cancélala para conservar el historial de ventas.',
      );
    }

    // Borra ganadores primero (su FK hacia el boleto es restrictiva); el resto
    // (boletos, órdenes, imágenes, promociones) cae por cascada al borrar la rifa.
    await prisma.$transaction([
      prisma.winner.deleteMany({ where: { raffleId: id } }),
      prisma.raffle.delete({ where: { id } }),
    ]);

    await logActivity({ userId: request.auth!.userId, type: 'RAFFLE', action: 'delete_raffle', meta: { raffleId: id } });
    return { ok: true };
  });
}
