// Idioma y moneda del sitio ("Modo USA"), disponibles en toda la app.
//
// Se inicializan de forma SÍNCRONA desde los atributos que el backend inyecta en
// el HTML (ver apps/api/src/lib/site-html.ts), igual que se hace con el tema
// oscuro: así la página pública ya se pinta en inglés en el primer render, sin
// el parpadeo de "español → inglés" al llegar la respuesta de la API.
// En desarrollo (Vite sirve el index.html tal cual) no hay atributos y se
// corrige al cargar el perfil.
import { create } from 'zustand';
import { translate, isLocale, isCurrency, formatMoney, type Currency, type Locale, type MessageKey } from '@bismark/shared';

interface SiteState {
  locale: Locale;
  currency: Currency;
  setSite: (site: { locale?: Locale | null; currency?: Currency | null }) => void;
}

function fromHtml(): { locale: Locale; currency: Currency } {
  if (typeof document === 'undefined') return { locale: 'es', currency: 'MXN' };
  const el = document.documentElement;
  const locale = el.getAttribute('data-locale');
  const currency = el.getAttribute('data-currency');
  return {
    locale: isLocale(locale) ? locale : 'es',
    currency: isCurrency(currency) ? currency : 'MXN',
  };
}

export const useSiteStore = create<SiteState>((set) => ({
  ...fromHtml(),
  setSite: ({ locale, currency }) =>
    set((s) => ({
      locale: isLocale(locale) ? locale : s.locale,
      currency: isCurrency(currency) ? currency : s.currency,
    })),
}));

// ── Uso en componentes ──────────────────────────────────────
// `useT()` se suscribe al idioma: al cambiar, el componente se vuelve a pintar.
export function useT(): (key: MessageKey, vars?: Record<string, string | number>) => string {
  const locale = useSiteStore((s) => s.locale);
  return (key, vars) => translate(locale, key, vars);
}

export function useLocale(): Locale {
  return useSiteStore((s) => s.locale);
}

// Formatea dinero en la moneda del sitio y re-pinta si la moneda cambia.
export function useMoney(): (amount: number) => string {
  const currency = useSiteStore((s) => s.currency);
  return (amount) => formatMoney(amount, currency);
}

// ── Uso fuera de React (toasts, manejadores, utilidades) ────
export function t(key: MessageKey, vars?: Record<string, string | number>): string {
  return translate(useSiteStore.getState().locale, key, vars);
}

export function money(amount: number): string {
  return formatMoney(amount, useSiteStore.getState().currency);
}

export function siteLocale(): Locale {
  return useSiteStore.getState().locale;
}
