import { RESERVED_SLUGS, SLUG_REGEX, PHONE_COUNTRIES, DEFAULT_COUNTRY, type CountryCode } from './constants.js';

// ── Slug ────────────────────────────────────────────────────
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quitar acentos
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

export function isValidSlug(slug: string): boolean {
  return SLUG_REGEX.test(slug) && !isReservedSlug(slug);
}

export function isReservedSlug(slug: string): boolean {
  return (RESERVED_SLUGS as readonly string[]).includes(slug.toLowerCase());
}

// ── Boletos ─────────────────────────────────────────────────
export function formatTicketNumber(n: number, padding: number): string {
  return String(n).padStart(padding, '0');
}

// ── Oportunidades (boletos de regalo) ───────────────────────
// Por cada boleto manual elegido, el comprador recibe (opportunities - 1) números
// de regalo. Los regalos viven en un rango de emisiones EXTRA, posterior al rango
// manual, así nunca chocan con los boletos seleccionables a mano.
//
// Manual:  [ticketStart, ticketStart + totalTickets - 1]
// Regalo:  [manualEnd + 1, ticketStart + totalTickets*opportunities - 1]
//
// Con opportunities <= 1 NO hay rango de regalo (devuelve null): comportamiento
// idéntico al sistema original.
export interface GiftRange {
  start: number;
  end: number;
  count: number; // totalTickets * (opportunities - 1)
}

export function totalEmissions(totalTickets: number, opportunities: number): number {
  return totalTickets * Math.max(1, opportunities);
}

export function giftTicketRange(
  ticketStart: number,
  totalTickets: number,
  opportunities: number,
): GiftRange | null {
  if (!opportunities || opportunities <= 1 || totalTickets <= 0) return null;
  const manualEnd = ticketStart + totalTickets - 1;
  const end = ticketStart + totalEmissions(totalTickets, opportunities) - 1;
  return { start: manualEnd + 1, end, count: totalTickets * (opportunities - 1) };
}

// ── Dinero (MXN) ────────────────────────────────────────────
export function formatMXN(pesos: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(pesos);
}

// ── Folio de orden ──────────────────────────────────────────
export function generateOrderCode(seed?: string): string {
  // BSK-XXXXXX (base36). Si no se pasa seed, el backend debe pasar uno único.
  const base = (seed ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const tail = base.slice(-6).padStart(6, '0');
  return `BSK-${tail}`;
}

// ── Países / lada ───────────────────────────────────────────
// Normaliza un código de país a uno soportado (MX/US); cae a MX por defecto.
export function normalizeCountryCode(code: string | null | undefined): CountryCode {
  const up = (code ?? '').toUpperCase();
  return PHONE_COUNTRIES.find((c) => c.code === up)?.code ?? DEFAULT_COUNTRY;
}

// Lada telefónica de un país (52 para México, 1 para USA). Cae a 52.
export function dialCodeForCountry(code: string | null | undefined): string {
  const up = (code ?? '').toUpperCase();
  return PHONE_COUNTRIES.find((c) => c.code === up)?.dialCode ?? '52';
}

// ── WhatsApp ────────────────────────────────────────────────
// Arma el número internacional para wa.me. `dialCode` es la lada del comprador
// (52 México por defecto, 1 USA). Si el número ya viene con lada (>10 dígitos)
// se respeta tal cual; sólo se antepone la lada a un número nacional de 10.
export function sanitizePhoneForWa(phone: string, dialCode: string = '52'): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `${dialCode}${digits}`;
  return digits;
}

export function buildWhatsappLink(phone: string, message: string, dialCode: string = '52'): string {
  const num = sanitizePhoneForWa(phone, dialCode);
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

export interface WaTemplateVars {
  raffleName: string;
  ticketNumbers: string; // ya formateados separados por coma
  total: string; // ya formateado MXN
  orderCode: string;
}

export function waReserveMessage(v: WaTemplateVars): string {
  return `Hola, quiero confirmar mi apartado para la rifa ${v.raffleName}. Mis boletos son: ${v.ticketNumbers}. Mi total es: ${v.total}. Mi folio de orden es: ${v.orderCode}.`;
}

export function waProofMessage(v: WaTemplateVars): string {
  return `Hola, ya realicé el pago de la rifa ${v.raffleName}. Mis boletos son: ${v.ticketNumbers}. Mi folio es: ${v.orderCode}. Te envío mi comprobante.`;
}

// ── URLs / subdominios ──────────────────────────────────────
export interface PublicUrlConfig {
  rootDomain: string; // bismark.com
  useSubdomains: boolean; // true en prod
  protocol?: string; // https
}

export function riferoPublicUrl(slug: string, cfg: PublicUrlConfig): string {
  const proto = cfg.protocol ?? 'https';
  if (cfg.useSubdomains) return `${proto}://${slug}.${cfg.rootDomain}`;
  return `/r/${slug}`;
}

export function rafflePublicPath(slug: string, eventNumber: number, cfg: PublicUrlConfig): string {
  if (cfg.useSubdomains) return `${riferoPublicUrl(slug, cfg)}/e${eventNumber}`;
  return `/r/${slug}/e${eventNumber}`;
}

export function eventLabel(eventNumber: number): string {
  return `E${eventNumber}`;
}

// ── Fechas ──────────────────────────────────────────────────
export function formatDateMX(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(d);
}

export function formatDateTimeMX(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

// Tiempo restante legible (ej. "1h 23m")
export function timeRemaining(expiresAt: string | Date | null | undefined, now = new Date()): string | null {
  if (!expiresAt) return null;
  const end = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
  const ms = end.getTime() - now.getTime();
  if (ms <= 0) return null;
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
