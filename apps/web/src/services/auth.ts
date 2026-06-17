import { apiFetch, setAuthToken } from '@/lib/api';
import type { AuthUserDTO, LoginInput } from '@bismark/shared';

type AuthReply = { user: AuthUserDTO; token?: string };

// Guarda el token Bearer que acompaña a la cookie (fallback para navegadores
// que bloquean cookies, como Safari/iOS).
function keepToken(res: AuthReply): AuthReply {
  if (res.token) setAuthToken(res.token);
  return res;
}

export const authService = {
  login: (input: LoginInput) =>
    apiFetch<AuthReply>('/auth/login', { method: 'POST', body: input }).then(keepToken),
  logout: () =>
    apiFetch<{ ok: true }>('/auth/logout', { method: 'POST' }).finally(() => setAuthToken(null)),
  me: () => apiFetch<{ user: AuthUserDTO | null }>('/auth/me'),
};
