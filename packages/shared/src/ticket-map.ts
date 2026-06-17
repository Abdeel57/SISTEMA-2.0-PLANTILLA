import { TicketStatus } from './enums.js';

// ── Mapa compacto de boletos ─────────────────────────────────
// Para rifas grandes (hasta 1,000,000 de boletos) la API NO devuelve un objeto
// por boleto: devuelve un string con UN carácter por boleto (índice = número -
// ticketStart). Comprimido con gzip pesa unos pocos KB porque es muy repetitivo.
// El número y el displayNumber se derivan en el cliente con ticketStart y
// ticketFormat, así que el único dato por boleto es su estado.

export const TICKET_MAP_CHAR: Record<TicketStatus, string> = {
  [TicketStatus.AVAILABLE]: 'A',
  [TicketStatus.RESERVED]: 'R',
  [TicketStatus.PENDING_PAYMENT]: 'P',
  [TicketStatus.PAID]: 'S',
  [TicketStatus.RIFERO_RESERVED]: 'O',
  [TicketStatus.CANCELLED]: 'C',
  [TicketStatus.WINNER]: 'W',
} as const;

export const TICKET_STATUS_BY_CHAR: Record<string, TicketStatus> = Object.fromEntries(
  Object.entries(TICKET_MAP_CHAR).map(([status, ch]) => [ch, status as TicketStatus]),
);

// Respuesta del endpoint de mapa de boletos.
export interface TicketMapDTO {
  start: number; // primer número de boleto (ticketStart)
  total: number; // cantidad total de boletos
  format: number; // dígitos del displayNumber ("001" → 3)
  map: string; // un carácter por boleto (ver TICKET_MAP_CHAR)
  serverTime: string; // ISO; cursor para pedir cambios incrementales después
}

// Para el displayNumber usa formatTicketNumber (utils.ts): relleno SIN truncar.
