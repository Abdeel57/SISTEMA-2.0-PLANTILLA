/**
 * Memoria de los datos del comprador (localStorage).
 *
 * Objetivo: que una persona mayor **no vuelva a teclear** su nombre y teléfono
 * cada vez que aparta. Al apartar con éxito guardamos sus datos y la próxima
 * vez pre-llenamos el formulario (recompra de un toque).
 *
 * El comprador NO tiene cuenta ni notificaciones: esto es solo una comodidad
 * local en su propio dispositivo. Falla en silencio si no hay localStorage.
 */
import type { BuyerInput } from '@bismark/shared';

const KEY = 'bismark-buyer';

/** Lo que recordamos del comprador (mismos campos que el formulario). */
export type RememberedBuyer = BuyerInput;

/** Guarda los datos del comprador para pre-llenar la próxima vez. No lanza. */
export function rememberBuyer(buyer: BuyerInput): void {
  try {
    const clean: RememberedBuyer = {
      fullName: (buyer.fullName ?? '').trim(),
      phone: (buyer.phone ?? '').trim(),
      country: (buyer.country ?? '').trim(),
      whatsapp: (buyer.whatsapp ?? '').trim(),
      state: (buyer.state ?? '').trim(),
    };
    if (!clean.fullName && !clean.phone) return; // nada útil que guardar
    localStorage.setItem(KEY, JSON.stringify(clean));
  } catch {
    /* sin localStorage (incógnito): ignorar */
  }
}

/** Devuelve los datos recordados, o `null` si no hay nada guardado. No lanza. */
export function recallBuyer(): RememberedBuyer | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RememberedBuyer>;
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      fullName: typeof parsed.fullName === 'string' ? parsed.fullName : '',
      phone: typeof parsed.phone === 'string' ? parsed.phone : '',
      country: typeof parsed.country === 'string' ? parsed.country : '',
      whatsapp: typeof parsed.whatsapp === 'string' ? parsed.whatsapp : '',
      state: typeof parsed.state === 'string' ? parsed.state : '',
    };
  } catch {
    return null;
  }
}

/** Olvida los datos recordados (por si el comprador quiere empezar de cero). */
export function forgetBuyer(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignorar */
  }
}
