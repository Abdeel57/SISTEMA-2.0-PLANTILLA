import type { ReactNode } from 'react';

// Identidad visual por banco/método de pago mexicano. La tarjeta del método se
// tematiza sola a partir del texto que el rifero escribe en "Banco" (detección
// por palabras clave, sin acentos). `logo` es el wordmark/marca dibujado en SVG
// o tipografía fiel al banco.

export interface BankTheme {
  id: string;
  name: string;
  /** Fondo de la tarjeta (gradiente CSS). */
  bg: string;
  /** Color del texto principal sobre el fondo. */
  fg: string;
  /** Color suave para etiquetas secundarias. */
  fgSoft: string;
  /** Marca del banco (nodo listo para render). */
  logo: ReactNode;
  keywords: string[];
  /**
   * Etiqueta del "usuario" del método, para monederos de Estados Unidos que no
   * usan CLABE ni número de tarjeta: Cash App cobra a un $cashtag, Venmo a un
   * @usuario y Zelle a un correo o teléfono. Vacío = método bancario clásico.
   */
  handleLabel?: { es: string; en: string };
  /** Ejemplo que se muestra como placeholder en el panel. */
  handlePlaceholder?: string;
}

const wordmark = (text: string, style: React.CSSProperties = {}) => (
  <span
    style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontWeight: 800, letterSpacing: '-0.02em', ...style }}
    className="text-xl leading-none"
  >
    {text}
  </span>
);

// Llama de Santander (simplificada)
const SantanderFlame = (
  <span className="flex items-center gap-1.5">
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M14.6 4c.7 2 .3 3.4-.7 4.9-1 1.4-1.6 2.5-1.2 4.1-1.8-.8-2.7-2.4-2.3-4.3-2.4 1.2-3.9 3.4-3.9 5.9 0 3.5 3.4 5.4 7 5.4s7-1.9 7-5.4c0-3.9-3.3-8-5.9-10.6z" />
    </svg>
    {wordmark('Santander', { fontWeight: 700 })}
  </span>
);

// Hexágono HSBC (simplificado)
const HsbcMark = (
  <span className="flex items-center gap-2">
    <svg viewBox="0 0 28 14" className="h-4 w-8" aria-hidden>
      <path d="M7 0h14l7 7-7 7H7L0 7z" fill="#DB0011" />
      <path d="M7 0l7 7-7 7zM21 0l-7 7 7 7z" fill="#fff" />
    </svg>
    {wordmark('HSBC', { letterSpacing: '0.04em' })}
  </span>
);

export const BANKS: BankTheme[] = [
  {
    id: 'bbva',
    name: 'BBVA',
    bg: 'linear-gradient(135deg, #0b3a75 0%, #004481 45%, #062a52 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.65)',
    logo: wordmark('BBVA', { letterSpacing: '0.06em' }),
    keywords: ['bbva', 'bancomer'],
  },
  {
    id: 'banorte',
    name: 'Banorte',
    bg: 'linear-gradient(135deg, #c41524 0%, #eb0029 50%, #8f0e1c 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.7)',
    logo: wordmark('BANORTE', { fontStyle: 'italic', letterSpacing: '-0.01em' }),
    keywords: ['banorte'],
  },
  {
    id: 'santander',
    name: 'Santander',
    bg: 'linear-gradient(135deg, #d40000 0%, #ec0000 50%, #9e0000 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.7)',
    logo: SantanderFlame,
    keywords: ['santander'],
  },
  {
    id: 'banamex',
    name: 'Citibanamex',
    bg: 'linear-gradient(135deg, #00477d 0%, #00558c 55%, #012f52 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.65)',
    logo: wordmark('citibanamex', { fontWeight: 700, textTransform: 'lowercase' }),
    keywords: ['banamex', 'citibanamex', 'citi'],
  },
  {
    id: 'hsbc',
    name: 'HSBC',
    bg: 'linear-gradient(135deg, #262626 0%, #111111 60%, #000000 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.6)',
    logo: HsbcMark,
    keywords: ['hsbc'],
  },
  {
    id: 'scotiabank',
    name: 'Scotiabank',
    bg: 'linear-gradient(135deg, #c8102e 0%, #ec111a 55%, #8e0c1f 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.7)',
    logo: wordmark('Scotiabank', { fontWeight: 700 }),
    keywords: ['scotia'],
  },
  {
    id: 'azteca',
    name: 'Banco Azteca',
    bg: 'linear-gradient(135deg, #00744a 0%, #006341 55%, #003d28 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.7)',
    logo: wordmark('Banco Azteca', { fontWeight: 700 }),
    keywords: ['azteca'],
  },
  {
    id: 'bancoppel',
    name: 'BanCoppel',
    bg: 'linear-gradient(135deg, #0a55a8 0%, #0057b8 55%, #003a7a 100%)',
    fg: '#ffe600',
    fgSoft: 'rgba(255,255,255,0.75)',
    logo: wordmark('BanCoppel', { color: '#ffe600' }),
    keywords: ['coppel', 'bancoppel'],
  },
  {
    id: 'inbursa',
    name: 'Inbursa',
    bg: 'linear-gradient(135deg, #074a86 0%, #003865 55%, #01233f 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.65)',
    logo: wordmark('INBURSA', { letterSpacing: '0.08em', fontWeight: 700 }),
    keywords: ['inbursa'],
  },
  {
    id: 'banregio',
    name: 'Banregio',
    bg: 'linear-gradient(135deg, #ff7a1a 0%, #ff6a14 55%, #c44e0a 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.75)',
    logo: wordmark('banregio', { textTransform: 'lowercase', fontWeight: 700 }),
    keywords: ['banregio'],
  },
  {
    id: 'nu',
    name: 'Nu',
    bg: 'linear-gradient(135deg, #9929ea 0%, #820ad1 55%, #5a0691 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.7)',
    logo: wordmark('nu', { textTransform: 'lowercase', fontWeight: 800, fontSize: '1.6rem' }),
    keywords: ['nu ', 'nubank', 'nu mexico', 'nu méxico'],
  },
  {
    id: 'hey',
    name: 'Hey Banco',
    bg: 'linear-gradient(135deg, #16181d 0%, #0b0c0f 60%, #000 100%)',
    fg: '#2ee6a8',
    fgSoft: 'rgba(255,255,255,0.6)',
    logo: wordmark('hey', { color: '#2ee6a8', textTransform: 'lowercase', fontSize: '1.5rem' }),
    keywords: ['hey'],
  },
  {
    id: 'klar',
    name: 'Klar',
    bg: 'linear-gradient(135deg, #1f1f23 0%, #0f0f12 60%, #000 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.6)',
    logo: wordmark('klar', { textTransform: 'lowercase', letterSpacing: '0.02em' }),
    keywords: ['klar'],
  },
  {
    id: 'mercadopago',
    name: 'Mercado Pago',
    bg: 'linear-gradient(135deg, #00a6e8 0%, #009ee3 55%, #0070a8 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.75)',
    logo: wordmark('mercado pago', { textTransform: 'lowercase', fontWeight: 800 }),
    keywords: ['mercado pago', 'mercadopago'],
  },
  {
    id: 'oxxo',
    name: 'OXXO',
    bg: 'linear-gradient(135deg, #ffd100 0%, #ffd100 100%)',
    fg: '#e10718',
    fgSoft: 'rgba(0,0,0,0.55)',
    logo: (
      <span
        className="rounded-md px-2 py-0.5 text-xl font-black leading-none"
        style={{ background: '#e10718', color: '#ffd100', letterSpacing: '0.02em' }}
      >
        OXXO
      </span>
    ),
    keywords: ['oxxo', 'deposito en tienda', 'depósito en tienda'],
  },
  {
    id: 'bienestar',
    name: 'Banco del Bienestar',
    bg: 'linear-gradient(135deg, #ab2a4d 0%, #9f2241 55%, #6d1730 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.7)',
    logo: wordmark('Banco del Bienestar', { fontWeight: 700, fontSize: '1rem' }),
    keywords: ['bienestar'],
  },
  {
    id: 'spei',
    name: 'Transferencia SPEI',
    bg: 'linear-gradient(135deg, #283447 0%, #1b2436 55%, #10182a 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.6)',
    logo: wordmark('SPEI®', { letterSpacing: '0.06em' }),
    keywords: ['spei', 'transferencia'],
  },

  // ── Métodos de Estados Unidos ("Modo USA") ────────────────────────────────
  // Los más usados para cobros entre particulares. Igual que los mexicanos, el
  // pago sigue siendo manual: el comprador envía y sube su comprobante.
  {
    id: 'zelle',
    name: 'Zelle',
    bg: 'linear-gradient(135deg, #6d1ed4 0%, #6001d2 50%, #40018c 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.7)',
    logo: (
      <span className="flex items-center gap-1.5">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M13.2 2h-2.4v2.3H6.3v2.6h6.1L6 17.1V22h11.7v-2.6h-6.4l6.4-10.2V4.3h-4.5V2z" />
        </svg>
        {wordmark('Zelle', { fontWeight: 800 })}
      </span>
    ),
    keywords: ['zelle'],
    handleLabel: { es: 'Correo o teléfono', en: 'Email or phone' },
    handlePlaceholder: 'nombre@correo.com',
  },
  {
    id: 'cashapp',
    name: 'Cash App',
    bg: 'linear-gradient(135deg, #00d54b 0%, #00c244 50%, #018f33 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.75)',
    logo: (
      <span className="flex items-center gap-1.5">
        <span
          className="grid h-6 w-6 place-items-center rounded-lg text-base font-black"
          style={{ background: 'rgba(255,255,255,0.9)', color: '#00c244' }}
        >
          $
        </span>
        {wordmark('Cash App', { fontWeight: 800 })}
      </span>
    ),
    keywords: ['cash app', 'cashapp', 'cashtag'],
    handleLabel: { es: 'Cashtag', en: 'Cashtag' },
    handlePlaceholder: '$turifa',
  },
  {
    id: 'venmo',
    name: 'Venmo',
    bg: 'linear-gradient(135deg, #3d95ce 0%, #008cff 50%, #0064b8 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.72)',
    logo: wordmark('venmo', { fontWeight: 800, textTransform: 'lowercase' }),
    keywords: ['venmo'],
    handleLabel: { es: 'Usuario', en: 'Username' },
    handlePlaceholder: '@turifa',
  },
  {
    id: 'paypal',
    name: 'PayPal',
    bg: 'linear-gradient(135deg, #009cde 0%, #0070ba 45%, #003087 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.7)',
    logo: (
      <span className="flex items-baseline">
        {wordmark('Pay', { fontWeight: 800, fontStyle: 'italic' })}
        <span
          style={{ fontFamily: '"Plus Jakarta Sans", system-ui, sans-serif', fontWeight: 800, fontStyle: 'italic' }}
          className="text-xl leading-none opacity-80"
        >
          Pal
        </span>
      </span>
    ),
    keywords: ['paypal', 'pay pal'],
    handleLabel: { es: 'Correo de PayPal', en: 'PayPal email' },
    handlePlaceholder: 'nombre@correo.com',
  },
  {
    id: 'applepay',
    name: 'Apple Pay',
    bg: 'linear-gradient(135deg, #2e2e2e 0%, #1a1a1a 55%, #000000 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.6)',
    logo: (
      <span className="flex items-center gap-1">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <path d="M16.2 12.7c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-.1-2.5.8-3.1.8-.6 0-1.6-.7-2.7-.7-1.4 0-2.7.8-3.4 2.1-1.4 2.5-.4 6.2 1 8.3.7 1 1.5 2.1 2.6 2.1 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.6 1.1 0 1.8-1 2.5-2 .8-1.2 1.1-2.3 1.1-2.3s-2.2-.9-2.2-3.3zM14.3 5.9c.6-.7 1-1.7.9-2.7-.8 0-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6.9.1 1.9-.5 2.5-1.2z" />
        </svg>
        {wordmark('Pay', { fontWeight: 700 })}
      </span>
    ),
    keywords: ['apple pay', 'applepay'],
  },
  {
    id: 'chime',
    name: 'Chime',
    bg: 'linear-gradient(135deg, #1ec677 0%, #0fae66 55%, #087a47 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.72)',
    logo: wordmark('chime', { fontWeight: 800, textTransform: 'lowercase' }),
    keywords: ['chime'],
  },
  {
    id: 'ach',
    name: 'Bank transfer (ACH)',
    bg: 'linear-gradient(135deg, #1f3a5f 0%, #16293f 55%, #0d1728 100%)',
    fg: '#ffffff',
    fgSoft: 'rgba(255,255,255,0.62)',
    logo: wordmark('ACH Transfer', { fontWeight: 700, fontSize: '1rem' }),
    keywords: ['ach', 'wire', 'routing', 'bank transfer', 'chase', 'bank of america', 'wells fargo'],
  },
];

// Tema genérico (banco no reconocido): tarjeta oscura premium neutra.
export const GENERIC_BANK: BankTheme = {
  id: 'generic',
  name: 'Cuenta bancaria',
  bg: 'linear-gradient(135deg, #2a2f3a 0%, #171b24 55%, #0c0f16 100%)',
  fg: '#ffffff',
  fgSoft: 'rgba(255,255,255,0.6)',
  logo: wordmark('Cuenta bancaria', { fontWeight: 700, fontSize: '1rem' }),
  keywords: [],
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

/** Detecta el tema del banco a partir del texto libre que escribió el rifero. */
export function detectBank(bankText: string | null | undefined): BankTheme {
  if (!bankText) return GENERIC_BANK;
  const t = ` ${normalize(bankText)} `;
  for (const b of BANKS) {
    if (b.keywords.some((k) => t.includes(normalize(k)))) return b;
  }
  return { ...GENERIC_BANK, name: bankText, logo: wordmark(bankText, { fontWeight: 700, fontSize: '1rem' }) };
}
