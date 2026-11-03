import { TICKET_MAP_CHAR, giftTicketRange, type TicketMapDTO } from '@bismark/shared';
import type { TicketStatus } from '@prisma/client';
import { prisma } from './prisma.js';

const AVAILABLE_CODE = TICKET_MAP_CHAR.AVAILABLE.charCodeAt(0);

interface RaffleShape {
  id: string;
  ticketStart: number;
  totalTickets: number;
  ticketFormat: number;
  opportunities: number;
}

// Construye el mapa compacto de estados: un carácter por boleto (índice =
// número - ticketStart). Solo consulta los boletos NO disponibles, en bloques
// por rango de número, así una rifa de 1,000,000 de boletos responde rápido y
// el JSON (muy repetitivo) viaja comprimido en unos pocos KB.
const RANGE_CHUNK = 200_000;

export async function buildTicketMap(raffle: RaffleShape): Promise<TicketMapDTO> {
  const { id, ticketStart: start, totalTickets: total, ticketFormat: format } = raffle;
  const serverTime = new Date().toISOString();

  const chars = Buffer.alloc(total, AVAILABLE_CODE);
  const end = start + total - 1;

  for (let from = start; from <= end; from += RANGE_CHUNK) {
    const to = Math.min(from + RANGE_CHUNK - 1, end);
    const rows: { number: number; status: TicketStatus }[] = await prisma.ticketNumber.findMany({
      where: {
        raffleId: id,
        status: { not: 'AVAILABLE' },
        number: { gte: from, lte: to },
      },
      select: { number: true, status: true },
    });
    for (const r of rows) {
      const idx = r.number - start;
      if (idx >= 0 && idx < total) chars[idx] = TICKET_MAP_CHAR[r.status].charCodeAt(0);
    }
  }

  // El rango de regalo no entra al mapa (no se elige a mano), pero el cliente lo
  // necesita para reconocer un número de regalo al buscarlo.
  const gift = giftTicketRange(start, total, raffle.opportunities);

  return {
    start,
    total,
    format,
    map: chars.toString('latin1'),
    serverTime,
    gift: gift ? { start: gift.start, total: gift.count } : null,
  };
}
