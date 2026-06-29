import { apiFetch } from '@/lib/api';
import type { OrderDTO, PaymentProofDTO } from '@bismark/shared';

export type OrderFilter = 'pending' | 'paid' | 'all';

export const orderService = {
  list: (status: OrderFilter = 'all', raffleId?: string, q?: string) =>
    apiFetch<{ items: OrderDTO[] }>('/orders', { query: { status, raffleId, q } }),
  get: (id: string) => apiFetch<{ order: OrderDTO }>(`/orders/${id}`),
  markPaid: (id: string) => apiFetch<{ order: OrderDTO }>(`/orders/${id}/mark-paid`, { method: 'PATCH' }),
  cancel: (id: string) => apiFetch<{ order: OrderDTO }>(`/orders/${id}/cancel`, { method: 'PATCH' }),
  reject: (id: string) => apiFetch<{ order: OrderDTO }>(`/orders/${id}/reject`, { method: 'PATCH' }),
  proofs: (id: string) => apiFetch<{ items: PaymentProofDTO[] }>(`/orders/${id}/proof`),
  // # de órdenes que requieren acción del rifero (badge de la tuerca).
  pendingCount: () => apiFetch<{ count: number }>('/orders/pending-count'),
};
