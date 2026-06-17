import { apiFetch } from '@/lib/api';
import type { RiferoProfileDTO, UpdateRiferoInput } from '@bismark/shared';

export const riferoService = {
  me: () => apiFetch<{ profile: RiferoProfileDTO }>('/riferos/me'),
  update: (input: UpdateRiferoInput) =>
    apiFetch<{ profile: RiferoProfileDTO }>('/riferos/me', { method: 'PATCH', body: input }),
};
