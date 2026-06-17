import { prisma } from './prisma.js';
import { giftTicketRange } from '@bismark/shared';

// Genera las filas TicketNumber para una rifa directamente en PostgreSQL con
// generate_series: una rifa de 1,000,000 de boletos se crea en segundos (en vez
// de cientos de createMany). Se trocea en bloques para no mantener una sola
// sentencia gigante y poder reanudar si algo falla (ON CONFLICT no duplica).
const SQL_CHUNK = 250_000;

export async function generateTickets(
  raffleId: string,
  start: number,
  count: number,
  format: number,
  isGift = false,
): Promise<void> {
  for (let offset = 0; offset < count; offset += SQL_CHUNK) {
    const from = start + offset;
    const to = start + Math.min(offset + SQL_CHUNK, count) - 1;
    // displayNumber igual que formatTicketNumber: relleno a `format` dígitos SIN
    // truncar (lpad de Postgres SÍ trunca, por eso el GREATEST con la longitud).
    await prisma.$executeRaw`
      INSERT INTO "TicketNumber" ("id", "raffleId", "number", "displayNumber", "status", "isGift", "createdAt", "updatedAt")
      SELECT
        gen_random_uuid()::text,
        ${raffleId},
        n,
        lpad(n::text, GREATEST(length(n::text), ${format}::int), '0'),
        'AVAILABLE'::"TicketStatus",
        ${isGift},
        now(),
        now()
      FROM generate_series(${from}::int, ${to}::int) AS n
      ON CONFLICT ("raffleId", "number") DO NOTHING
    `;
  }
}

// Genera el rango manual y, si opportunities > 1, también el rango de regalo.
// Centraliza el cálculo de emisiones para crear/regenerar una rifa.
export async function generateAllTickets(
  raffleId: string,
  ticketStart: number,
  totalTickets: number,
  format: number,
  opportunities: number,
): Promise<void> {
  await generateTickets(raffleId, ticketStart, totalTickets, format, false);
  const gift = giftTicketRange(ticketStart, totalTickets, opportunities);
  if (gift) {
    await generateTickets(raffleId, gift.start, gift.count, format, true);
  }
}

// ¿Tiene la rifa boletos comprometidos (apartados/pagados/reservados)?
export async function hasCommittedTickets(raffleId: string): Promise<boolean> {
  const n = await prisma.ticketNumber.count({
    where: {
      raffleId,
      status: { in: ['RESERVED', 'PENDING_PAYMENT', 'PAID', 'RIFERO_RESERVED', 'WINNER'] },
    },
  });
  return n > 0;
}
