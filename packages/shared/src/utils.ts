import { RESERVED_SLUGS, SLUG_REGEX, PHONE_COUNTRIES, DEFAULT_COUNTRY, type CountryCode } from './constants.js';
import { intlLocale, type Currency, type Locale } from './i18n.js';

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

// ── Dinero ──────────────────────────────────────────────────
// La moneda la elige el rifero (MXN o USD, "Modo USA"). Los importes se guardan
// como enteros, así que no se muestran decimales en ninguna de las dos.
export function formatMoney(amount: number, currency: Currency = 'MXN'): string {
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// Atajo histórico (pesos). Se conserva para el panel del rifero, que siempre
// muestra la moneda del sitio vía formatMoney.
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

// Número para MOSTRAR con su lada: "+52 662 123 4567". Agrupa 3-3-4 los números
// nacionales de 10 dígitos; si ya viene con lada u otro largo, lo deja tal cual.
export function formatPhoneIntl(phone: string, country?: string | null): string {
  const digits = phone.replace(/\D/g, '');
  const dial = dialCodeForCountry(country);
  const national =
    digits.length === 10 ? digits : digits.startsWith(dial) ? digits.slice(dial.length) : digits;
  const grouped =
    national.length === 10
      ? `${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`
      : national;
  return `+${dial} ${grouped}`;
}

export interface WaTemplateVars {
  raffleName: string;
  ticketNumbers: string; // ya formateados separados por coma
  total: string; // ya formateado en la moneda del sitio
  orderCode: string;
  buyerName?: string; // nombre del comprador (opcional)
  buyerPhone?: string; // teléfono del comprador (opcional). Vacío = sin línea.
  buyerState?: string | null; // estado/origen del comprador (opcional). Vacío/null = sin línea.
  paymentUrl?: string; // liga a "Métodos de pago" de la página (opcional)
  giftNumbers?: string; // boletos de regalo (oportunidades), ya formateados. Vacío = sin línea.
  locale?: Locale; // idioma del sitio ("Modo USA"). Default español.
}

// Etiquetas de los mensajes de WhatsApp, por idioma.
const WA = {
  es: {
    reserved: '🎟️ *¡APARTÉ MIS BOLETOS!*',
    paid: '✅ *¡YA REALICÉ MI PAGO!*',
    raffle: 'Rifa',
    name: 'Nombre',
    phone: 'Teléfono',
    state: 'Estado',
    tickets: 'Boletos',
    gifts: 'Boletos de regalo',
    totalToPay: 'Total a pagar',
    total: 'Total',
    code: 'Folio',
    payMethods: '💳 *Métodos de pago:*',
    reservedClose: '🙌 Quedo al pendiente para completar mi pago. ¡Gracias!',
    paidClose: '📎 Te envío mi comprobante para que confirmes mi pago. ¡Gracias! 🙌',
  },
  en: {
    reserved: '🎟️ *I RESERVED MY TICKETS!*',
    paid: '✅ *I ALREADY SENT MY PAYMENT!*',
    raffle: 'Giveaway',
    name: 'Name',
    phone: 'Phone',
    state: 'State',
    tickets: 'Tickets',
    gifts: 'Free tickets',
    totalToPay: 'Total to pay',
    total: 'Total',
    code: 'Code',
    payMethods: '💳 *Payment methods:*',
    reservedClose: "🙌 I'll complete my payment shortly. Thank you!",
    paidClose: '📎 Here is my receipt so you can confirm my payment. Thank you! 🙌',
  },
} as const;

// Mensaje que el comprador envía al rifero tras apartar. Usa formato de WhatsApp
// (*negritas*) y saltos de línea para que la información quede ordenada. Si se
// pasa `paymentUrl`, agrega la liga directa a los métodos de pago de la página.
export function waReserveMessage(v: WaTemplateVars): string {
  const w = WA[v.locale === 'en' ? 'en' : 'es'];
  const lines = [
    w.reserved,
    `📌 *${w.raffle}:* ${v.raffleName}`,
    '',
    v.buyerName ? `👤 *${w.name}:* ${v.buyerName}` : null,
    v.buyerPhone ? `📞 *${w.phone}:* ${v.buyerPhone}` : null,
    v.buyerState ? `📍 *${w.state}:* ${v.buyerState}` : null,
    `🔢 *${w.tickets}:* ${v.ticketNumbers}`,
    v.giftNumbers ? `🎁 *${w.gifts}:* ${v.giftNumbers}` : null,
    `💵 *${w.totalToPay}:* ${v.total}`,
    `🧾 *${w.code}:* ${v.orderCode}`,
    v.paymentUrl ? '' : null,
    v.paymentUrl ? w.payMethods : null,
    v.paymentUrl ? v.paymentUrl : null,
    '',
    w.reservedClose,
  ].filter((line) => line !== null);
  return lines.join('\n');
}

// Mensaje que el comprador envía al rifero cuando ya pagó (aviso + comprobante).
export function waProofMessage(v: WaTemplateVars): string {
  const w = WA[v.locale === 'en' ? 'en' : 'es'];
  const lines = [
    w.paid,
    `📌 *${w.raffle}:* ${v.raffleName}`,
    '',
    v.buyerName ? `👤 *${w.name}:* ${v.buyerName}` : null,
    v.buyerPhone ? `📞 *${w.phone}:* ${v.buyerPhone}` : null,
    v.buyerState ? `📍 *${w.state}:* ${v.buyerState}` : null,
    `🔢 *${w.tickets}:* ${v.ticketNumbers}`,
    v.giftNumbers ? `🎁 *${w.gifts}:* ${v.giftNumbers}` : null,
    `💵 *${w.total}:* ${v.total}`,
    `🧾 *${w.code}:* ${v.orderCode}`,
    '',
    w.paidClose,
  ].filter((line) => line !== null);
  return lines.join('\n');
}

export interface WaTicketReadyVars {
  raffleName: string;
  ticketNumbers: string; // ya formateados separados por coma
  ticketUrl: string; // liga al boleto digital (página, sin descargar)
  buyerName?: string; // nombre del comprador (se usa solo el primer nombre)
  riferoName?: string; // nombre público del organizador (firma del mensaje)
  locale?: Locale; // idioma del sitio ("Modo USA"). Default español.
}

// Mensaje que el ORGANIZADOR envía al comprador al confirmar su pago: avisa que
// el boleto ya está listo y le comparte la liga a su boleto digital (lo abre, no
// necesita descargar nada). Pensado para pegarse en WhatsApp tal cual.
export function waTicketReadyMessage(v: WaTicketReadyVars): string {
  const firstName = (v.buyerName ?? '').trim().split(/\s+/)[0];
  const en = v.locale === 'en';
  const greeting = en
    ? firstName
      ? `🎉 *Hi ${firstName}!*`
      : '🎉 *Hi!*'
    : firstName
      ? `🎉 *¡Hola ${firstName}!*`
      : '🎉 *¡Hola!*';
  const lines = en
    ? [
        greeting,
        '*Your payment is confirmed!* ✅',
        '',
        `📌 *Giveaway:* ${v.raffleName}`,
        `🔢 *Your tickets:* ${v.ticketNumbers}`,
        '',
        '🎟️ *Your digital ticket* (just open it, no download needed):',
        v.ticketUrl,
        '',
        '🍀 Good luck!',
        v.riferoName ? `— *${v.riferoName}*` : null,
      ]
    : [
        greeting,
        '*¡Tu pago quedó confirmado!* ✅',
        '',
        `📌 *Rifa:* ${v.raffleName}`,
        `🔢 *Tus boletos:* ${v.ticketNumbers}`,
        '',
        '🎟️ *Tu boleto digital* (ábrelo, no necesitas descargar nada):',
        v.ticketUrl,
        '',
        '🍀 ¡Mucha suerte!',
        v.riferoName ? `— *${v.riferoName}*` : null,
      ];
  return lines.filter((line) => line !== null).join('\n');
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
// El idioma del sitio decide el formato: "8 de agosto de 2026" / "August 8, 2026".
export function formatDate(date: string | Date, locale: Locale = 'es'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: 'long' }).format(d);
}

export function formatDateTime(date: string | Date, locale: Locale = 'es'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(intlLocale(locale), { dateStyle: 'medium', timeStyle: 'short' }).format(d);
}

// Atajos históricos en español (los usa el panel del rifero).
export function formatDateMX(date: string | Date): string {
  return formatDate(date, 'es');
}

export function formatDateTimeMX(date: string | Date): string {
  return formatDateTime(date, 'es');
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
