import { webEnv } from './env';

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// ── Token Bearer (fallback de sesión) ────────────────────────
// La sesión principal es la cookie httpOnly, pero Safari/iOS bloquea cookies
// cross-site cuando web y API viven en dominios distintos (*.up.railway.app).
// Guardamos el JWT que devuelve el login y lo enviamos como Authorization;
// el API acepta cualquiera de los dos.
const TOKEN_KEY = 'bsk_token';

export function setAuthToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // localStorage puede no estar disponible (modo privado antiguo); la cookie sigue siendo el plan A.
  }
}

function authHeaders(): Record<string, string> {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

type Json = Record<string, unknown> | unknown[];

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: Json;
  signal?: AbortSignal;
  query?: Record<string, string | number | undefined>;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const base = path.startsWith('http') ? path : `${webEnv.apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export async function apiFetch<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers: {
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
      ...authHeaders(),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'include',
    signal: opts.signal,
  });

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const p = (payload ?? {}) as { error?: string; message?: string; details?: unknown };
    throw new ApiError(res.status, p.error ?? 'error', p.message ?? 'Ocurrió un error', p.details);
  }
  return payload as T;
}

// Subir un archivo (multipart). Devuelve la respuesta JSON.
export async function apiUpload<T>(path: string, file: File, query?: RequestOptions['query']): Promise<T> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(buildUrl(path, query), {
    method: 'POST',
    headers: authHeaders(),
    body: form,
    credentials: 'include',
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const p = (payload ?? {}) as { error?: string; message?: string };
    throw new ApiError(res.status, p.error ?? 'error', p.message ?? 'Error al subir archivo');
  }
  return payload as T;
}

// Construye la URL hacia un recurso de la API (PDF, imágenes locales).
// Los archivos subidos (/uploads) y los assets demo se sirven en la RAÍZ del
// mismo origen, NO bajo /api; las rutas de API sí llevan el prefijo.
export function apiAssetUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  if (path.startsWith('/uploads/') || path.startsWith('/demo-assets/')) return path;
  return `${webEnv.apiUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

// Descarga un archivo (reporte/PDF) respetando cookies de sesión.
export async function apiDownload(path: string, filename: string, query?: RequestOptions['query']): Promise<void> {
  const res = await fetch(buildUrl(path, query), { credentials: 'include', headers: authHeaders() });
  if (!res.ok) {
    const p = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(res.status, 'download_error', p?.message ?? 'No se pudo descargar el archivo');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
