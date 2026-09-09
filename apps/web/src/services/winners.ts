import { apiFetch } from '@/lib/api';
import type { WinnerDTO, DrawInput } from '@bismark/shared';

export const winnerService = {
  draw: (raffleId: string, input: DrawInput) =>
    apiFetch<{ winners: WinnerDTO[] }>(`/raffles/${raffleId}/draw`, { method: 'POST', body: input }),
  // Deshace un sorteo lanzado por error: borra los ganadores, devuelve sus
  // boletos a "pagado" y reabre la rifa para poder seguir vendiendo.
  undoDraw: (raffleId: string) =>
    apiFetch<{ ok: true; restoredTickets: number; reopened: boolean }>(`/raffles/${raffleId}/draw`, {
      method: 'DELETE',
    }),
  list: (raffleId: string) => apiFetch<{ items: WinnerDTO[] }>(`/raffles/${raffleId}/winners`),
  setPublished: (winnerId: string, published: boolean) =>
    apiFetch<{ winner: WinnerDTO }>(`/winners/${winnerId}/publish`, { method: 'PATCH', body: { published } }),
  setEvidence: (raffleId: string, evidenceUrl: string) =>
    apiFetch<{ ok: true; evidenceUrl: string | null }>(`/raffles/${raffleId}/evidence`, {
      method: 'POST',
      body: { evidenceUrl },
    }),
};
