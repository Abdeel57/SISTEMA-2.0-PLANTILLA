// Pixel de Facebook (Meta) del rifero. El ID se configura en el panel
// (Configuración → Pixel de Facebook) y viaja en el perfil público, así que
// cambiarlo NO requiere volver a desplegar.
//
// Solo se carga en las páginas PÚBLICAS (nunca en el panel del admin: medir al
// propio organizador ensuciaría sus públicos y sus conversiones) y solo si hay
// un ID guardado: sin ID, todas las funciones son no-op y no se descarga nada.
//
// El script oficial de Meta se inyecta una sola vez; los eventos posteriores
// pasan por la cola `fbq` (el propio SDK la reproduce al terminar de cargar).

// Eventos estándar de Meta que usa el embudo de la rifa. Nombres exactos del
// catálogo de Meta: cualquier otro se reportaría como evento personalizado.
export type PixelEvent = 'PageView' | 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Lead';

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  push?: unknown;
  loaded?: boolean;
  version?: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

const SCRIPT_URL = 'https://connect.facebook.net/en_US/fbevents.js';
let currentId: string | null = null;
// Eventos ocurridos ANTES de conocer el ID del pixel. El perfil del rifero llega
// por API, así que una rifa puede cargar (y disparar ViewContent) antes: sin esta
// cola se perderían justo los eventos de la primera pantalla, que son los más
// valiosos. Se vacía al inicializar; si nunca hay pixel, se descarta.
const pending: Array<[PixelEvent, Record<string, unknown> | undefined]> = [];
const MAX_PENDING = 20;

// Instala el stub de `fbq` y descarga el SDK (una sola vez por sesión).
function ensureSdk(): Fbq | null {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  if (window.fbq) return window.fbq;

  const fbq: Fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue?.push(args);
  } as Fbq;
  fbq.queue = [];
  fbq.loaded = true;
  fbq.version = '2.0';
  window.fbq = fbq;
  if (!window._fbq) window._fbq = fbq;

  const script = document.createElement('script');
  script.async = true;
  script.src = SCRIPT_URL;
  document.head.appendChild(script);
  return fbq;
}

// Arranca el pixel del rifero. Idempotente: repetir el mismo ID no hace nada,
// y sin ID (null/'') no se carga el SDK.
export function initPixel(pixelId: string | null | undefined): void {
  const id = (pixelId ?? '').trim();
  if (!id || id === currentId) return;
  const fbq = ensureSdk();
  if (!fbq) return;
  fbq('init', id);
  currentId = id;
  // Vacía lo ocurrido antes de conocer el ID (ver `pending`).
  while (pending.length) {
    const next = pending.shift();
    if (next) fbq('track', next[0], next[1]);
  }
}

// Reporta un evento estándar. Si el pixel aún no arranca, el evento espera en la
// cola; si el rifero no configuró ninguno, nunca se envía nada.
export function pixelTrack(event: PixelEvent, props?: Record<string, unknown>): void {
  if (!currentId || !window.fbq) {
    if (pending.length < MAX_PENDING) pending.push([event, props]);
    return;
  }
  window.fbq('track', event, props);
}
