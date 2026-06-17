import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { badRequest, conflict } from '../../lib/errors.js';
import { requireStaff } from '../../middlewares/auth.js';
import { loadAccessibleOrder } from '../../lib/ownership.js';
import { toOrderDTO, type OrderWithRelations } from '../../lib/serializers.js';
import { logActivity } from '../../lib/activity.js';
import { newDigitalTicketCode } from '../../lib/codes.js';
import type { OrderStatus } from '@bismark/shared';
import type { FastifyRequest } from 'fastify';

const ORDER_INCLUDE = {
  raffle: true,
  buyer: true,
  tickets: true,
  paymentProofs: { orderBy: { uploadedAt: 'asc' } as const },
  digitalTicket: true,
  seller: { select: { id: true, name: true, sellerCode: true } },
} as const;

// Acota por vendedor: un SELLER solo ve/gestiona sus propias órdenes; los
// administradores ven todas las del rifero.
function sellerScope(request: FastifyRequest): { sellerId?: string } {
  return request.auth!.role === 'SELLER' ? { sellerId: request.auth!.userId } : {};
}

export default async function ordersRoutes(app: FastifyInstance): Promise<void> {
  // GET /orders?status=pending|paid|all&raffleId=...
  // Administradores ven todas las órdenes del rifero; vendedores solo las suyas.
  app.get('/orders', { preHandler: requireStaff }, async (request) => {
    const riferoId = request.auth!.riferoId!;
    const q = request.query as { status?: string; raffleId?: string };

    let statusFilter: OrderStatus[] | undefined;
    if (q.status === 'pending') statusFilter = ['RESERVED', 'PENDING'];
    else if (q.status === 'paid') statusFilter = ['PAID'];
    else statusFilter = undefined; // all

    const orders = await prisma.order.findMany({
      where: {
        raffle: { riferoId },
        ...sellerScope(request),
        ...(q.raffleId ? { raffleId: q.raffleId } : {}),
        ...(statusFilter ? { status: { in: statusFilter } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: ORDER_INCLUDE,
      take: 500,
    });

    return { items: orders.map((o) => toOrderDTO(o as OrderWithRelations)) };
  });

  // GET /orders/pending-count — # de órdenes que requieren acción.
  // Alimenta el badge de "órdenes nuevas" (acotado por vendedor si aplica).
  app.get('/orders/pending-count', { preHandler: requireStaff }, async (request) => {
    const riferoId = request.auth!.riferoId!;
    const count = await prisma.order.count({
      where: { raffle: { riferoId }, ...sellerScope(request), status: { in: ['RESERVED', 'PENDING'] } },
    });
    return { count };
  });

  // GET /orders/:id
  app.get('/orders/:id', { preHandler: requireStaff }, async (request) => {
    const { id } = request.params as { id: string };
    await loadAccessibleOrder(id, request.auth!);
    const order = await prisma.order.findUniqueOrThrow({ where: { id }, include: ORDER_INCLUDE });
    return { order: toOrderDTO(order as OrderWithRelations) };
  });

  // PATCH /orders/:id/mark-paid
  app.patch('/orders/:id/mark-paid', { preHandler: requireStaff }, async (request) => {
    const { id } = request.params as { id: string };
    const order = await loadAccessibleOrder(id, request.auth!);
    if (order.status === 'PAID') throw conflict('La orden ya está pagada');
    if (order.status === 'CANCELLED' || order.status === 'REJECTED' || order.status === 'EXPIRED') {
      throw badRequest('No puedes marcar como pagada una orden cancelada/rechazada/expirada');
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.ticketNumber.updateMany({
        where: { orderId: id },
        data: { status: 'PAID', paidAt: now, reservedUntil: null },
      }),
      prisma.order.update({ where: { id }, data: { status: 'PAID', paidAt: now, expiresAt: null } }),
      prisma.paymentProof.updateMany({ where: { orderId: id, status: 'PENDING' }, data: { status: 'APPROVED', reviewedAt: now } }),
      // El boleto digital se genera AQUÍ (al confirmar el pago), no en la reserva. Idempotente.
      prisma.digitalTicket.upsert({
        where: { orderId: id },
        update: {},
        create: { orderId: id, code: newDigitalTicketCode() },
      }),
    ]);

    await logActivity({ userId: request.auth!.userId, type: 'ORDER', action: 'mark_paid', meta: { orderId: id } });
    const fresh = await prisma.order.findUniqueOrThrow({ where: { id }, include: ORDER_INCLUDE });
    return { order: toOrderDTO(fresh as OrderWithRelations) };
  });

  // PATCH /orders/:id/cancel
  app.patch('/orders/:id/cancel', { preHandler: requireStaff }, async (request) => {
    const { id } = request.params as { id: string };
    await loadAccessibleOrder(id, request.auth!);
    await releaseOrder(id, 'CANCELLED');
    await logActivity({ userId: request.auth!.userId, type: 'ORDER', action: 'cancel', meta: { orderId: id } });
    const fresh = await prisma.order.findUniqueOrThrow({ where: { id }, include: ORDER_INCLUDE });
    return { order: toOrderDTO(fresh as OrderWithRelations) };
  });

  // PATCH /orders/:id/reject
  app.patch('/orders/:id/reject', { preHandler: requireStaff }, async (request) => {
    const { id } = request.params as { id: string };
    await loadAccessibleOrder(id, request.auth!);
    await releaseOrder(id, 'REJECTED');
    await prisma.paymentProof.updateMany({ where: { orderId: id, status: 'PENDING' }, data: { status: 'REJECTED', reviewedAt: new Date() } });
    await logActivity({ userId: request.auth!.userId, type: 'ORDER', action: 'reject', meta: { orderId: id } });
    const fresh = await prisma.order.findUniqueOrThrow({ where: { id }, include: ORDER_INCLUDE });
    return { order: toOrderDTO(fresh as OrderWithRelations) };
  });
}

// Libera boletos de una orden (vuelven a AVAILABLE) y marca el estado final.
async function releaseOrder(orderId: string, finalStatus: 'CANCELLED' | 'REJECTED'): Promise<void> {
  await prisma.$transaction([
    prisma.ticketNumber.updateMany({
      where: { orderId, status: { in: ['RESERVED', 'PENDING_PAYMENT', 'PAID'] } },
      data: { status: 'AVAILABLE', orderId: null, buyerId: null, reservedUntil: null, paidAt: null },
    }),
    prisma.order.update({ where: { id: orderId }, data: { status: finalStatus, expiresAt: null } }),
  ]);
}
