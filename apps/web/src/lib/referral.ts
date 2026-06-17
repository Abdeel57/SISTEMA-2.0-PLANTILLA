// Referencia de vendedor: cuando un comprador llega por el link de un vendedor
// (/eN/CODE o ?ref=CODE), guardamos el código durante la sesión para atribuirle
// la venta al apartar — aunque el comprador navegue por la página antes.
const KEY = 'bsk_ref';
const CODE_RE = /^[A-Z0-9]{2,12}$/;

// Guarda el código de vendedor si es válido. Acepta de path param o query.
export function rememberReferral(code: string | null | undefined): void {
  if (!code) return;
  const clean = code.trim().toUpperCase();
  if (!CODE_RE.test(clean)) return;
  try {
    sessionStorage.setItem(KEY, clean);
  } catch {
    /* almacenamiento no disponible: la referencia simplemente no persiste */
  }
}

// Código de vendedor recordado en esta sesión (o null).
export function getReferral(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
