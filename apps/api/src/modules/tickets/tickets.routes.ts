import type { FastifyInstance } from 'fastify';
import { reserveTicketsSchema, reserveManualSchema, normalizeCountryCode, computeOrderPrice, TicketStatus } from '@bismark/shared';
import { prisma } from '../../lib/prisma.js';
import { validate } from '../../lib/http.js';
import { badRequest, conflict, notFound, forbidden } from '../../lib/errors.js';
import { requireRifero } from '../../middlewares/auth.js';
import { loadOwnedRaffle } from '../../lib/ownership.js';
import { buildTicketMap } from '../../lib/ticket-map.js';
import { getPlanContext } from '../../lib/plan.js';
import { newOrderCode } from '../../lib/codes.js';
import { toBuyerDTO, riferoPaymentMethods, rafflePricingTiers, rafflePricingBundles } from '../../lib/serializers.js';
import { logActivity } from '../../lib/activity.js';
import { sendNewOrderEmail } from '../../lib/mailer.js';
import { sendPushToUser } from '../../lib/push.js';
import { env } from '../../config/env.js';

export default async function ticketsRoutes(app: FastifyInstance): Promise<void> {
  // GET /raffles/:id/ticket-map — mapa compacto de estados para el rifero dueño.
  // El detalle de cada boleto (comprador, orden) se pide por número al tocarlo.
  app.get('/raffles/:id/ticket-map', { preHandler: requireRifero }, async (request) => {
    const { id } = request.params as { id: string };
    const raffle = await loadOwnedRaffle(id, request.auth!);
    return buildTicketMap(raffle);
  });

  // GET /raffles/:id/tickets/:number — detalle de UN boleto (incluye comprador)
  app.get('/raffles/:id/tickets/:number', { preHandler: requireRifero }, async (request) => {
    const { id, number } = request.params as { id: string; number: string };
    await loadOwnedRaffle(id, request.auth!);
    const n = Number(number);
    if (!Number.isInteger(n)) throw badRequest('Número de boleto inválido');
    const t = await prisma.ticketNumber.findUnique({
      where: { raffleId_number: { raffleId: id, number: n } },
      include: { buyer: true, order: { select: { code: true } } },
    });
    if (!t) throw notFound('Boleto no encontrado');
    // Si es regalo, resuelve el display del boleto manual que lo generó.
    let parentDisplay: string | null = null;
    if (t.isGift && t.parentNumber != null) {
      const parent = await prisma.ticketNumber.findUnique({
        where: { raffleId_number: { raffleId: id, number: t.parentNumber } },
        select: { displayNumber: true },
      });
      parentDisplay = parent?.displayNumber ?? null;
    }
    return {
      ticket: {
        id: t.id,
        number: t.number,
        displayNumber: t.displayNumber,
        status: t.status,
        reservedUntil: t.reservedUntil?.toISOString() ?? null,
        paidAt: t.paidAt?.toISOString() ?? null,
        orderId: t.orderId,
        orderCode: t.order?.code ?? null,
        buyer: t.buyer ? toBuyerDTO(t.buyer) : null,
        isGift: t.isGift,
        parentDisplayNumber: parentDisplay,
      },
    };
  });

  // POST /public/raffles/:id/reserve — apartar boletos (comprador sin cuenta)
  app.post(
    '/public/raffles/:id/reserve',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const data = validate(reserveTicketsSchema, request.body);

      const raffle = await prisma.raffle.findUnique({ where: { id } });
      if (!raffle) throw notFound('Rifa no encontrada');
      if (raffle.status !== 'PUBLISHED') throw forbidden('Esta rifa no está disponible para apartar');

      const ctx = await getPlanContext(raffle.riferoId);
      if (!ctx.hasActivePlan) throw forbidden('Esta rifa no está disponible en este momento');

      const numbers = [...new Set(data.ticketNumbers)];
      if (numbers.some((n) => n < raffle.ticketStart || n > raffle.ticketEnd)) {
        throw badRequest('Algunos boletos están fuera del rango de la rifa');
      }
      if (raffle.maxTicketsPerOrder && numbers.length > raffle.maxTicketsPerOrder) {
        throw badRequest(`Máximo ${raffle.maxTicketsPerOrder} boletos por orden`);
      }

      const expiresAt = new Date(Date.now() + raffle.reserveMinutes * 60_000);
      // Total autoritativo: el backend recalcula con el motor de precios (niveles
      // y paquetes) para que no se pueda manipular desde el navegador.
      const totalAmount = computeOrderPrice(numbers.length, {
        basePrice: raffle.ticketPrice,
        tiers: rafflePricingTiers(raffle),
        bundles: rafflePricingBundles(raffle),
      }).total;

      // Atribución de venta: si llegó un código de vendedor (de su link) y existe
      // un vendedor ACTIVO de ESTE rifero con ese código, se le atribuye la orden.
      // Si no, queda como venta directa (sellerId = null). Nunca rompe el apartado.
      let sellerId: string | null = null;
      if (data.sellerCode && data.sellerCode.trim()) {
        const seller = await prisma.user.findFirst({
          where: {
            sellerCode: data.sellerCode.trim().toUpperCase(),
            role: 'SELLER',
            status: 'ACTIVE',
            memberOfRiferoId: raffle.riferoId,
          },
          select: { id: true },
        });
        sellerId = seller?.id ?? null;
      }

      const result = await prisma.$transaction(async (tx) => {
        // Bloqueo optimista: sólo cambian los que están AVAILABLE.
        const updated = await tx.ticketNumber.updateMany({
          where: { raffleId: id, number: { in: numbers }, status: 'AVAILABLE' },
          data: { status: 'RESERVED', reservedUntil: expiresAt },
        });
        if (updated.count !== numbers.length) {
          throw conflict('Algunos boletos ya no están disponibles. Actualiza y vuelve a intentar.');
        }

        const buyer = await tx.buyer.create({
          data: {
            fullName: data.buyer.fullName,
            phone: data.buyer.phone,
            country: normalizeCountryCode(data.buyer.country),
            whatsapp: data.buyer.whatsapp || data.buyer.phone,
            state: data.buyer.state || null,
          },
        });

        const order = await tx.order.create({
          data: {
            code: newOrderCode(),
            raffleId: id,
            buyerId: buyer.id,
            totalAmount,
            status: 'RESERVED',
            expiresAt,
            sellerId,
          },
        });

        const ticketRows = await tx.ticketNumber.findMany({
          where: { raffleId: id, number: { in: numbers } },
          select: { id: true, number: true, displayNumber: true },
          orderBy: { number: 'asc' },
        });

        await tx.ticketNumber.updateMany({
          where: { id: { in: ticketRows.map((t) => t.id) } },
          data: { orderId: order.id, buyerId: buyer.id },
        });

        await tx.orderTicket.createMany({
          data: ticketRows.map((t) => ({ orderId: order.id, ticketId: t.id })),
        });

        // ── Oportunidades: boletos de REGALO ──────────────────────────────
        // Por cada boleto manual se asignan (opportunities - 1) números del pool
        // de regalo. Se toman al azar y se BLOQUEAN con FOR UPDATE SKIP LOCKED:
        // dos compras simultáneas nunca reciben el mismo regalo (cada una salta
        // las filas ya bloqueadas por la otra). Si no alcanza el pool, se lanza
        // un error y la transacción revierte: nunca se crea una orden incompleta.
        const giftDisplayNumbers: string[] = [];
        const giftsPerManual = raffle.opportunities - 1;
        if (giftsPerManual > 0) {
          const totalGiftsNeeded = ticketRows.length * giftsPerManual;
          const giftRows = await tx.$queryRaw<Array<{ id: string; displayNumber: string }>>`
            SELECT "id", "displayNumber"
            FROM "TicketNumber"
            WHERE "raffleId" = ${id} AND "isGift" = true AND "status" = 'AVAILABLE'::"TicketStatus"
            ORDER BY random()
            LIMIT ${totalGiftsNeeded}
            FOR UPDATE SKIP LOCKED
          `;
          if (giftRows.length < totalGiftsNeeded) {
            throw conflict(
              'No hay suficientes oportunidades de regalo disponibles para completar tu compra. Intenta con menos boletos.',
            );
          }
          // Reparte los regalos: cada boleto manual recibe su bloque y queda como
          // parentNumber (para poder rastrear qué manual generó cada regalo).
          for (let i = 0; i < ticketRows.length; i++) {
            const slice = giftRows.slice(i * giftsPerManual, (i + 1) * giftsPerManual);
            if (slice.length === 0) continue;
            await tx.ticketNumber.updateMany({
              where: { id: { in: slice.map((g) => g.id) } },
              data: {
                status: 'RESERVED',
                reservedUntil: expiresAt,
                orderId: order.id,
                buyerId: buyer.id,
                parentNumber: ticketRows[i]!.number,
              },
            });
            giftDisplayNumbers.push(...slice.map((g) => g.displayNumber));
          }
          await tx.orderTicket.createMany({
            data: giftRows.map((g) => ({ orderId: order.id, ticketId: g.id })),
          });
        }

        // NO se crea el boleto digital aquí: se genera solo cuando el organizador
        // confirma el pago (en PATCH /orders/:id/mark-paid).
        return {
          order,
          buyer,
          displayNumbers: ticketRows.map((t) => t.displayNumber),
          giftDisplayNumbers,
        };
      });

      await logActivity({ type: 'ORDER', action: 'reserve', meta: { orderId: result.order.id }, ip: request.ip });

      const profile = await prisma.riferoProfile.findUniqueOrThrow({
        where: { id: raffle.riferoId },
        include: { user: { select: { email: true, name: true } } },
      });

      // Aviso al rifero de la nueva orden. No bloquea la respuesta (sin await) y
      // sendEmail nunca lanza: un fallo de correo no debe romper el apartado.
      // La columna email guarda el "usuario" de acceso; solo es un correo real
      // si contiene @ (el aviso principal es el push de abajo).
      if (profile.user.email.includes('@')) {
        const base = env.publicWebUrl || `${request.protocol}://${request.headers.host ?? ''}`;
        void sendNewOrderEmail({
          to: profile.user.email,
          riferoName: profile.user.name,
          buyerName: result.buyer.fullName,
          raffleTitle: raffle.title,
          eventLabel: `E${raffle.eventNumber}`,
          ticketCount: result.displayNumbers.length,
          totalAmount,
          orderCode: result.order.code,
          panelUrl: `${base}/admin/ordenes`,
        });
      }

      // Push al rifero (solo organizadores). Best-effort, sin await.
      void sendPushToUser(profile.userId, {
        title: 'Nueva orden 🎟️',
        body: `${result.buyer.fullName} apartó ${result.displayNumbers.length} boleto(s) · $${totalAmount.toLocaleString('es-MX')}`,
        url: '/admin/ordenes',
      });

      return reply.code(201).send({
        receipt: {
          code: result.order.code,
          raffleTitle: raffle.title,
          eventLabel: `E${raffle.eventNumber}`,
          ticketNumbers: result.displayNumbers,
          giftNumbers: result.giftDisplayNumbers,
          opportunities: raffle.opportunities,
          totalAmount,
          status: result.order.status,
          expiresAt: result.order.expiresAt?.toISOString() ?? null,
          digitalTicketCode: null, // aún no existe; se genera al confirmar el pago
          riferoPublicName: profile.publicName,
          riferoWhatsapp: profile.payWhatsapp || profile.whatsapp,
          paymentProfile: {
            holderName: profile.payHolderName,
            bank: profile.payBank,
            clabe: profile.payClabe,
            cardNumber: profile.payCardNumber,
            concept: profile.payConcept,
            instructions: profile.payInstructions || raffle.paymentInstructions,
            whatsapp: profile.payWhatsapp || profile.whatsapp,
            methods: riferoPaymentMethods(profile),
          },
        },
      });
    },
  );

  // POST /tickets/reserve-manual — el rifero reserva boletos manualmente
  app.post('/tickets/reserve-manual', { preHandler: requireRifero }, async (request) => {
    const body = request.body as { raffleId?: string };
    const raffleId = body.raffleId;
    if (!raffleId) throw badRequest('raffleId requerido');
    const raffle = await loadOwnedRaffle(raffleId, request.auth!);
    const data = validate(reserveManualSchema, request.body);

    const numbers = [...new Set(data.ticketNumbers)];
    const updated = await prisma.ticketNumber.updateMany({
      where: { raffleId: raffle.id, number: { in: numbers }, status: 'AVAILABLE' },
      data: { status: 'RIFERO_RESERVED' },
    });
    if (updated.count !== numbers.length) {
      throw conflict('Algunos boletos no estaban disponibles para reservar');
    }
    await logActivity({ userId: request.auth!.userId, type: 'TICKET', action: 'reserve_manual', meta: { raffleId, count: numbers.length } });
    return { reserved: updated.count };
  });

  // PATCH /tickets/:id/status — cambiar estado de un boleto (rifero dueño)
  app.patch('/tickets/:id/status', { preHandler: requireRifero }, async (request) => {
    const { id } = request.params as { id: string };
    const { status } = request.body as { status?: string };
    const allowed: TicketStatus[] = ['AVAILABLE', 'RIFERO_RESERVED', 'CANCELLED'];
    if (!status || !allowed.includes(status as TicketStatus)) {
      throw badRequest('Estado no permitido. Usa AVAILABLE, RIFERO_RESERVED o CANCELLED.');
    }
    const ticket = await prisma.ticketNumber.findUnique({ where: { id }, include: { raffle: true } });
    if (!ticket) throw notFound('Boleto no encontrado');
    if (request.auth!.role !== 'SUPER_ADMIN' && ticket.raffle.riferoId !== request.auth!.riferoId) {
      throw forbidden('Este boleto no te pertenece');
    }
    if (ticket.status === 'PAID' || ticket.status === 'WINNER') {
      throw conflict('No puedes cambiar el estado de un boleto pagado o ganador');
    }
    await prisma.ticketNumber.update({
      where: { id },
      data: { status: status as TicketStatus, orderId: null, buyerId: null, reservedUntil: null },
    });
    return { ok: true };
  });
}
