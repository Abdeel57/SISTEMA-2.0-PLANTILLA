import { prisma } from './prisma.js';
import type { RaffleStats } from './serializers.js';

// Cuenta boletos por estado para una rifa.
export async function getRaffleStats(raffleId: string, totalTickets: number): Promise<RaffleStats> {
  // Solo boletos MANUALES: los de regalo son emisiones extra y no cuentan en el
  // progreso de venta ni en la disponibilidad del pool seleccionable.
  const grouped = await prisma.ticketNumber.groupBy({
    by: ['status'],
    where: { raffleId, isGift: false },
    _count: { _all: true },
  });
  const map = new Map(grouped.map((g) => [g.status, g._count._all]));
  // Los ganadores siguen contando como vendidos (eran boletos pagados).
  const soldCount = (map.get('PAID') ?? 0) + (map.get('WINNER') ?? 0);
  const reservedCount = (map.get('RESERVED') ?? 0) + (map.get('PENDING_PAYMENT') ?? 0);
  const available = map.get('AVAILABLE') ?? totalTickets - (soldCount + reservedCount);
  return { soldCount, reservedCount, availableCount: available };
}

// Cuenta sólo boletos pagados (para resúmenes públicos) en muchas rifas.
export async function getPaidCounts(raffleIds: string[]): Promise<Map<string, number>> {
  if (raffleIds.length === 0) return new Map();
  const grouped = await prisma.ticketNumber.groupBy({
    by: ['raffleId'],
    where: { raffleId: { in: raffleIds }, isGift: false, status: { in: ['PAID', 'WINNER'] } },
    _count: { _all: true },
  });
  return new Map(grouped.map((g) => [g.raffleId, g._count._all]));
}
