import { prisma } from './prisma.js';
import { notFound, forbidden } from './errors.js';
import type { Raffle, Order } from '@prisma/client';

// Garantiza que la rifa pertenezca al rifero (o que sea SUPER_ADMIN).
export async function loadOwnedRaffle(
  raffleId: string,
  auth: { role: string; riferoId: string | null },
): Promise<Raffle> {
  const raffle = await prisma.raffle.findUnique({ where: { id: raffleId } });
  if (!raffle) throw notFound('Rifa no encontrada');
  if (auth.role !== 'SUPER_ADMIN' && raffle.riferoId !== auth.riferoId) {
    throw forbidden('Esta rifa no te pertenece');
  }
  return raffle;
}

// Garantiza que la orden pertenezca a una rifa del rifero.
export async function loadOwnedOrder(
  orderId: string,
  auth: { role: string; riferoId: string | null },
): Promise<Order & { raffle: Raffle }> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { raffle: true } });
  if (!order) throw notFound('Orden no encontrada');
  if (auth.role !== 'SUPER_ADMIN' && order.raffle.riferoId !== auth.riferoId) {
    throw forbidden('Esta orden no te pertenece');
  }
  return order;
}

// Como loadOwnedOrder, pero además acota por vendedor: un SELLER solo puede
// acceder a órdenes atribuidas a él. Administradores ven todas las del rifero.
export async function loadAccessibleOrder(
  orderId: string,
  auth: { userId: string; role: string; riferoId: string | null },
): Promise<Order & { raffle: Raffle }> {
  const order = await loadOwnedOrder(orderId, auth);
  if (auth.role === 'SELLER' && order.sellerId !== auth.userId) {
    throw forbidden('Esta orden no te pertenece');
  }
  return order;
}
