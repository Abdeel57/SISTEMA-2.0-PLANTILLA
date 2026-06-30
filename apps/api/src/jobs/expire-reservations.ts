import { prisma } from '../lib/prisma.js';

// Libera apartados vencidos: órdenes RESERVED con expiresAt pasado → orden EXPIRED
// y sus boletos vuelven a AVAILABLE. Las órdenes PENDING (comprobante subido, en
// revisión del rifero) NO se expiran: ya no tienen expiresAt y su estado las excluye.
export async function releaseExpiredReservations(): Promise<number> {
  const now = new Date();
  const expired = await prisma.order.findMany({
    where: {
      status: 'RESERVED',
      expiresAt: { lt: now },
      // Respeta el interruptor del rifero: si desactivó la liberación automática,
      // sus apartados NO se expiran (los gestiona manualmente).
      raffle: { rifero: { autoReleaseExpired: true } },
    },
    select: { id: true },
    take: 200,
  });
  if (expired.length === 0) return 0;

  const orderIds = expired.map((o) => o.id);

  await prisma.$transaction([
    // Liberar boletos que aún están apartados/pendientes para esas órdenes.
    prisma.ticketNumber.updateMany({
      where: { orderId: { in: orderIds }, status: { in: ['RESERVED', 'PENDING_PAYMENT'] } },
      data: { status: 'AVAILABLE', orderId: null, buyerId: null, reservedUntil: null },
    }),
    prisma.order.updateMany({
      where: { id: { in: orderIds } },
      data: { status: 'EXPIRED' },
    }),
  ]);

  return orderIds.length;
}

// Inicia un intervalo que corre cada 60s. Devuelve función para detenerlo.
export function startExpiryJob(intervalMs = 60_000): () => void {
  const tick = async () => {
    try {
      const n = await releaseExpiredReservations();
      if (n > 0) console.log(`[expiry] Liberados ${n} apartados vencidos`);
    } catch (err) {
      console.error('[expiry] error', err);
    }
  };
  const handle = setInterval(() => void tick(), intervalMs);
  // No bloquear el cierre del proceso por el intervalo.
  if (typeof handle.unref === 'function') handle.unref();
  return () => clearInterval(handle);
}
