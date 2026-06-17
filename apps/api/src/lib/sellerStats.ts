import { prisma } from './prisma.js';
import type { SellerStatsDTO } from '@bismark/shared';

// Métricas de ventas atribuidas a un vendedor. Las usa "Usuarios y Roles" (vista
// del administrador) y el panel del propio vendedor.
export async function getSellerStats(sellerId: string): Promise<SellerStatsDTO> {
  const [ordersTotal, pendingOrders, paidAgg, cancelledOrders, ticketsSold] = await Promise.all([
    prisma.order.count({ where: { sellerId } }),
    prisma.order.count({ where: { sellerId, status: { in: ['RESERVED', 'PENDING'] } } }),
    prisma.order.aggregate({ where: { sellerId, status: 'PAID' }, _count: true, _sum: { totalAmount: true } }),
    prisma.order.count({ where: { sellerId, status: { in: ['CANCELLED', 'REJECTED', 'EXPIRED'] } } }),
    prisma.orderTicket.count({ where: { order: { sellerId, status: 'PAID' } } }),
  ]);

  return {
    ordersTotal,
    ticketsSold,
    revenue: paidAgg._sum.totalAmount ?? 0,
    pendingOrders,
    paidOrders: paidAgg._count,
    cancelledOrders,
  };
}
