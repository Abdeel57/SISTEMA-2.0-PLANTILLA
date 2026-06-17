import { apiFetch } from '@/lib/api';
import type {
  PanelUserDTO,
  SellerStatsDTO,
  CreatePanelUserInput,
  UpdatePanelUserInput,
} from '@bismark/shared';

export const userService = {
  // Staff del rifero (administradores + vendedores) con métricas por vendedor.
  list: () => apiFetch<{ items: PanelUserDTO[] }>('/users'),
  create: (input: CreatePanelUserInput) =>
    apiFetch<{ user: PanelUserDTO; tempPassword: string | null }>('/users', { method: 'POST', body: input }),
  update: (id: string, input: UpdatePanelUserInput) =>
    apiFetch<{ user: PanelUserDTO }>(`/users/${id}`, { method: 'PATCH', body: input }),
  // Métricas del propio vendedor (para su panel).
  myStats: () => apiFetch<{ stats: SellerStatsDTO }>('/seller/me/stats'),
};
