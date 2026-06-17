import type { FastifyInstance } from 'fastify';
import { drawSchema } from '@bismark/shared';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../lib/http.js';
import { badRequest, notFound, forbidden, conflict } from '../../lib/errors.js';
import { requireRifero } from '../../middlewares/auth.js';
import { loadOwnedRaffle } from '../../lib/ownership.js';
import { assertFeature } from '../../lib/plan.js';
import { secureRandomIndex } from '../../lib/codes.js';
import { toWinnerDTO } from '../../lib/serializers.js';
import { logActivity } from '../../lib/activity.js';

export default async function winnersRoutes(app: FastifyInstance): Promise<void> {
  // POST /raffles/:id/draw — sortea ganadores entre boletos pagados
  app.post('/raffles/:id/draw', { preHandler: requireRifero }, async (request) => {
    const { id } = request.params as { id: string };
    const raffle = await loadOwnedRaffle(id, request.auth!);
    const data = validate(drawSchema, request.body);

    if (data.prizes.length > 1) {
      await assertFeature(raffle.riferoId, 'allowMultipleWinners');
    }

    // Sólo participan boletos pagados. NO se carga el pool completo en memoria
    // (puede haber cientos de miles): se cuenta y se elige cada ganador con un
    // salto aleatorio sobre el índice (raffleId, status) ordenado por número.
    const poolCount = await prisma.ticketNumber.count({ where: { raffleId: id, status: 'PAID' } });
    if (poolCount === 0) throw badRequest('No hay boletos pagados que puedan participar en el sorteo');

    const existing = await prisma.winner.count({ where: { raffleId: id } });
    if (existing > 0) throw conflict('Esta rifa ya tiene ganadores registrados');

    const prizes = [...data.prizes].sort((a, b) => a.position - b.position);
    const chosen: { ticketId: string; buyerId: string | null; position: number; prizeDescription?: string }[] = [];
    const chosenIds: string[] = [];

    for (const prize of prizes) {
      const exclude = data.allowRepeatWinner ? [] : chosenIds;
      const remaining = poolCount - exclude.length;
      if (remaining <= 0) break;
      const offset = secureRandomIndex(remaining);
      const ticket = await prisma.ticketNumber.findFirst({
        where: { raffleId: id, status: 'PAID', ...(exclude.length ? { id: { notIn: exclude } } : {}) },
        orderBy: { number: 'asc' },
        skip: offset,
        select: { id: true, buyerId: true },
      });
      if (!ticket) break;
      chosen.push({ ticketId: ticket.id, buyerId: ticket.buyerId, position: prize.position, prizeDescription: prize.prizeDescription });
      chosenIds.push(ticket.id);
    }

    const userId = request.auth!.userId;
    const winners = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const c of chosen) {
        const w = await tx.winner.create({
          data: {
            raffleId: id,
            ticketId: c.ticketId,
            buyerId: c.buyerId,
            position: c.position,
            prizeDescription: c.prizeDescription ?? null,
            published: false,
            drawnById: userId,
          },
          include: { ticket: true, buyer: true },
        });
        created.push(w);
      }
      // Marcar boletos ganadores y cerrar la rifa.
      await tx.ticketNumber.updateMany({
        where: { id: { in: chosen.map((c) => c.ticketId) } },
        data: { status: 'WINNER' },
      });
      await tx.raffle.update({ where: { id }, data: { status: 'FINISHED' } });
      return created;
    });

    await logActivity({ userId, type: 'DRAW', action: 'draw', meta: { raffleId: id, winners: winners.length } });
    return { winners: winners.map((w) => toWinnerDTO(w, true)) };
  });

  // GET /raffles/:id/winners — vista del rifero dueño (incluye comprador)
  app.get('/raffles/:id/winners', { preHandler: requireRifero }, async (request) => {
    const { id } = request.params as { id: string };
    await loadOwnedRaffle(id, request.auth!);
    const winners = await prisma.winner.findMany({
      where: { raffleId: id },
      orderBy: { position: 'asc' },
      include: { ticket: true, buyer: true },
    });
    return { items: winners.map((w) => toWinnerDTO(w, true)) };
  });

  // PATCH /winners/:id/publish — publicar/ocultar un ganador
  app.patch('/winners/:id/publish', { preHandler: requireRifero }, async (request) => {
    const { id } = request.params as { id: string };
    const { published } = request.body as { published?: boolean };
    const winner = await prisma.winner.findUnique({ where: { id }, include: { raffle: true } });
    if (!winner) throw notFound('Ganador no encontrado');
    if (request.auth!.role !== 'SUPER_ADMIN' && winner.raffle.riferoId !== request.auth!.riferoId) {
      throw forbidden('Este registro no te pertenece');
    }
    const updated = await prisma.winner.update({
      where: { id },
      data: { published: published ?? !winner.published },
      include: { ticket: true, buyer: true },
    });
    return { winner: toWinnerDTO(updated, true) };
  });

  // POST /raffles/:id/evidence — adjunta el video/evidencia del sorteo (a todos los ganadores de la rifa)
  app.post('/raffles/:id/evidence', { preHandler: requireRifero }, async (request) => {
    const { id } = request.params as { id: string };
    const raffle = await loadOwnedRaffle(id, request.auth!);
    const { evidenceUrl } = request.body as { evidenceUrl?: string };
    if (evidenceUrl !== undefined && evidenceUrl !== '' && !/^https?:\/\/|^\/uploads\//.test(evidenceUrl)) {
      throw badRequest('URL de evidencia inválida');
    }
    const winnerCount = await prisma.winner.count({ where: { raffleId: id } });
    if (winnerCount === 0) throw badRequest('Primero realiza el sorteo para poder adjuntar la evidencia');

    await prisma.winner.updateMany({
      where: { raffleId: id },
      data: { evidenceUrl: evidenceUrl ? evidenceUrl : null },
    });
    await logActivity({ userId: request.auth!.userId, type: 'DRAW', action: 'set_evidence', meta: { raffleId: raffle.id } });
    return { ok: true, evidenceUrl: evidenceUrl || null };
  });
}
