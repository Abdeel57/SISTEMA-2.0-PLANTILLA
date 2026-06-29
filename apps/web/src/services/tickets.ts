import { apiFetch } from '@/lib/api';
import type { OrderReceiptDTO, ReserveTicketsInput, TicketStatus } from '@bismark/shared';

export const ticketService = {
  reserve: (raffleId: string, input: ReserveTicketsInput) =>
    apiFetch<{ receipt: OrderReceiptDTO }>(`/public/raffles/${raffleId}/reserve`, { method: 'POST', body: input }),
  // Sortea (sin reservar) números de regalo disponibles para mostrarlos al
  // seleccionar. Al apartar se reservan esos mismos (ver ticketService.reserve).
  drawGifts: (raffleId: string, count: number) =>
    apiFetch<{ gifts: { number: number; displayNumber: string }[] }>(
      `/public/raffles/${raffleId}/draw-gifts`,
      { method: 'POST', body: { count } },
    ),
  reserveManual: (raffleId: string, ticketNumbers: number[], note?: string) =>
    apiFetch<{ reserved: number }>('/tickets/reserve-manual', {
      method: 'POST',
      body: { raffleId, ticketNumbers, note },
    }),
  setStatus: (ticketId: string, status: TicketStatus) =>
    apiFetch<{ ok: true }>(`/tickets/${ticketId}/status`, { method: 'PATCH', body: { status } }),
};
