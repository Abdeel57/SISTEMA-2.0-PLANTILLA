import { randomBytes, randomInt, createHash } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin caracteres ambiguos

function randomCode(len: number): string {
  let out = '';
  const bytes = randomBytes(len);
  for (let i = 0; i < len; i++) {
    out += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return out;
}

// Folio de orden legible: BSK-XXXXXX
export function newOrderCode(): string {
  return `BSK-${randomCode(6)}`;
}

// Código de verificación de boleto digital: BSK-TKT-XXXXXXXX
export function newDigitalTicketCode(): string {
  return `TKT-${randomCode(8)}`;
}

// Selección aleatoria criptográficamente segura de un índice [0, n).
export function secureRandomIndex(n: number): number {
  if (n <= 0) throw new Error('n debe ser > 0');
  return randomInt(0, n);
}

// Hash determinista (sha256 hex) para guardar tokens sin exponer el valor en claro.
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Token de recuperación: valor en claro (va en el enlace) + su hash (va en la BD).
export function newResetToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url'); // ~43 chars URL-safe
  return { token, tokenHash: hashToken(token) };
}

// Contraseña temporal legible (sin caracteres ambiguos) para usuarios nuevos.
// Se muestra UNA sola vez al administrador que crea la cuenta.
export function newTempPassword(): string {
  return randomCode(10);
}

// Siguiente código de vendedor (VEN01, VEN02, …) a partir de los ya usados.
// Crece a 3+ dígitos tras VEN99. `existing` es la lista de códigos actuales.
export function nextSellerCode(existing: string[]): string {
  let max = 0;
  for (const code of existing) {
    const m = /^VEN(\d+)$/.exec(code ?? '');
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const next = max + 1;
  return `VEN${String(next).padStart(2, '0')}`;
}
