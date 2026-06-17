// Tiempo real de la cuadrícula de boletos por polling incremental.
//
// El cliente carga la cuadrícula completa una vez (GET /public/raffles/:id/ticket-map)
// y luego sondea aquí con `?since=<serverTime previo>` para traer SOLO los boletos
// que cambiaron (apartados/liberados/pagados). Robusto a través de proxies y
// compresión (a diferencia de SSE), y barato (índice por updatedAt implícito).

import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';

export default async function liveRoutes(app: FastifyInstance): Promise<void> {
  // GET /public/raffles/:raffleId/ticket-changes?since=<iso>
  app.get('/public/raffles/:raffleId/ticket-changes', async (request, reply) => {
    const { raffleId } = request.params as { raffleId: string };
    const { since } = request.query as { since?: string };

    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId }, select: { status: true } });
    if (!raffle || raffle.status === 'DRAFT') throw notFound('Rifa no encontrada');

    const serverTime = new Date().toISOString();

    // Sin `since` válido no devolvemos cambios: el cliente debe partir de la carga
    // completa y luego sondear con el serverTime que reciba.
    const sinceDate = since ? new Date(since) : null;
    if (!sinceDate || Number.isNaN(sinceDate.getTime())) {
      reply.header('Cache-Control', 'no-store');
      return { items: [], serverTime };
    }

    // Tope de seguridad: si cambió una cantidad enorme de boletos de golpe
    // (p. ej. re-numeración), avisamos con `truncated` y el cliente recarga el
    // mapa completo en lugar de aplicar parches incompletos.
    const MAX_CHANGES = 20_000;
    const items = await prisma.ticketNumber.findMany({
      where: { raffleId, updatedAt: { gt: sinceDate } },
      orderBy: { number: 'asc' },
      take: MAX_CHANGES + 1,
      select: { number: true, displayNumber: true, status: true },
    });
    const truncated = items.length > MAX_CHANGES;
    if (truncated) items.length = MAX_CHANGES;

    reply.header('Cache-Control', 'no-store');
    return { items, serverTime, truncated };
  });
}
