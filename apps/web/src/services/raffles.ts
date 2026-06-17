import { apiFetch } from '@/lib/api';
import type {
  RaffleDTO,
  CreateRaffleInput,
  UpdateRaffleInput,
  DashboardSummaryDTO,
  TicketMapDTO,
  BuyerDTO,
} from '@bismark/shared';

// Detalle de UN boleto (se pide bajo demanda al tocarlo en la cuadrícula).
export interface OwnerTicketDTO {
  id: string;
  number: number;
  displayNumber: string;
  status: string;
  reservedUntil: string | null;
  paidAt: string | null;
  orderId: string | null;
  orderCode: string | null;
  buyer: BuyerDTO | null;
  // Oportunidades: si es boleto de regalo y qué boleto manual lo generó.
  isGift: boolean;
  parentDisplayNumber: string | null;
}

export const raffleService = {
  dashboardSummary: () => apiFetch<{ summary: DashboardSummaryDTO }>('/dashboard/summary'),
  list: () => apiFetch<{ items: RaffleDTO[] }>('/raffles'),
  get: (id: string) => apiFetch<{ raffle: RaffleDTO }>(`/raffles/${id}`),
  create: (input: CreateRaffleInput) => apiFetch<{ raffle: RaffleDTO }>('/raffles', { method: 'POST', body: input }),
  update: (id: string, input: UpdateRaffleInput) =>
    apiFetch<{ raffle: RaffleDTO }>(`/raffles/${id}`, { method: 'PATCH', body: input }),
  publish: (id: string) => apiFetch<{ raffle: RaffleDTO }>(`/raffles/${id}/publish`, { method: 'POST' }),
  cancel: (id: string) => apiFetch<{ raffle: RaffleDTO }>(`/raffles/${id}/cancel`, { method: 'POST' }),
  remove: (id: string) => apiFetch<{ ok: boolean }>(`/raffles/${id}`, { method: 'DELETE' }),
  // Mapa compacto de estados (1 carácter por boleto): escala a 1M de boletos.
  ownerTicketMap: (id: string) => apiFetch<TicketMapDTO>(`/raffles/${id}/ticket-map`),
  ownerTicket: (id: string, number: number) =>
    apiFetch<{ ticket: OwnerTicketDTO }>(`/raffles/${id}/tickets/${number}`),
};
