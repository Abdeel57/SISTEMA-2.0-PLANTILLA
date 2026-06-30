import { apiFetch } from '@/lib/api';
import type { RiferoProfileDTO, UpdateRiferoInput } from '@bismark/shared';

export const riferoService = {
  me: () => apiFetch<{ profile: RiferoProfileDTO }>('/riferos/me'),
  // applyReserveToExisting: bandera opcional para que el tiempo de apartado se
  // aplique también a las rifas ya creadas (no es campo del perfil).
  update: (input: UpdateRiferoInput & { applyReserveToExisting?: boolean }) =>
    apiFetch<{ profile: RiferoProfileDTO }>('/riferos/me', { method: 'PATCH', body: input }),
};
