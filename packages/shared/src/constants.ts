// Constantes compartidas de la plataforma.

export const BRAND = {
  name: 'Sortea - Digital',
  poweredBy: 'Impulsado por Sortea',
  generatedBy: 'Generado por Sortea',
  rootDomain: 'sortea-digital.com', // placeholder; se define al configurar el dominio del deploy
} as const;

// Palabras reservadas que NO pueden usarse como slug/subdominio de rifero.
export const RESERVED_SLUGS = [
  'admin',
  'api',
  'www',
  'app',
  'dashboard',
  'login',
  'register',
  'registro',
  'sortea',
  'sorteadigital',
  'soporte',
  'support',
  'help',
  'ayuda',
  'static',
  'assets',
  'public',
  'validar',
  'validate',
  'super',
  'superadmin',
  'mail',
  'ftp',
  'cdn',
  'status',
  'about',
  'planes',
  'plans',
  'terminos',
  'privacidad',
  'r', // ruta de fallback local /r/:slug
] as const;

export const PLAN_SLUGS = {
  BASIC: 'basico',
  PRO: 'pro',
  VERIFIED: 'verificado',
} as const;

// Slug regex: letras minúsculas, números y guiones. 3-32 chars. No empieza/termina en guión.
export const SLUG_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])$/;

export const LIMITS = {
  slugMin: 3,
  slugMax: 32,
  imageMaxBytes: 5 * 1024 * 1024, // 5 MB
  proofMaxBytes: 5 * 1024 * 1024,
  videoMaxBytes: 50 * 1024 * 1024, // 50 MB (evidencia de sorteo)
  maxTicketsHardCap: 1_000_000, // tope de seguridad del sistema (boletos por rifa)
  maxTicketsPerOrderHardCap: 1000, // tope duro de boletos en una sola orden
  defaultReserveMinutes: 120,
} as const;

// Preguntas frecuentes por defecto de la página pública. Se muestran mientras
// el rifero no guarde las suyas, y precargan el editor del admin.
export const DEFAULT_FAQS = [
  {
    q: '¿Cómo participo?',
    a: 'Entra a la rifa, elige tus números disponibles, apártalos con tu nombre y teléfono, y realiza tu pago.',
  },
  {
    q: '¿Cómo pago mis boletos?',
    a: 'Haz tu transferencia o depósito a los datos del organizador (los ves en “Métodos de pago”) y sube tu comprobante. El organizador confirma tu pago.',
  },
  {
    q: '¿Dónde veo mis boletos?',
    a: 'En “Verificar mis boletos” buscas con tu teléfono tus boletos apartados o pagados, subes tu comprobante y abres tu boleto digital.',
  },
  {
    q: '¿Cuándo se realiza el sorteo?',
    a: 'En la fecha indicada en cada rifa. Tu boleto pagado es tu boleto participante.',
  },
  {
    q: '¿Es confiable?',
    a: 'Cada boleto pagado genera un boleto digital con código QR para validarlo el día del sorteo.',
  },
] as const;

export const ALLOWED_IMAGE_MIME = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export const ALLOWED_VIDEO_MIME = [
  'video/mp4',
  'video/webm',
  'video/quicktime', // .mov (iPhone)
] as const;

// ── Países / lada telefónica ─────────────────────────────────
// Países soportados para el teléfono del comprador. La lada (dialCode) se
// antepone al número nacional para armar el enlace de WhatsApp (wa.me/52…).
// México es el predeterminado; USA permite atender clientes con número +1.
export const PHONE_COUNTRIES = [
  { code: 'MX', label: 'México', dialCode: '52', flag: '🇲🇽' },
  { code: 'US', label: 'USA', dialCode: '1', flag: '🇺🇸' },
] as const;

export type CountryCode = (typeof PHONE_COUNTRIES)[number]['code'];

export const DEFAULT_COUNTRY: CountryCode = 'MX';

// Estados de USA (para el selector cuando el comprador elige USA). DC incluido.
export const US_STATES = [
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'District of Columbia',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming',
] as const;

export const MEXICAN_STATES = [
  'Aguascalientes',
  'Baja California',
  'Baja California Sur',
  'Campeche',
  'Chiapas',
  'Chihuahua',
  'Ciudad de México',
  'Coahuila',
  'Colima',
  'Durango',
  'Estado de México',
  'Guanajuato',
  'Guerrero',
  'Hidalgo',
  'Jalisco',
  'Michoacán',
  'Morelos',
  'Nayarit',
  'Nuevo León',
  'Oaxaca',
  'Puebla',
  'Querétaro',
  'Quintana Roo',
  'San Luis Potosí',
  'Sinaloa',
  'Sonora',
  'Tabasco',
  'Tamaulipas',
  'Tlaxcala',
  'Veracruz',
  'Yucatán',
  'Zacatecas',
] as const;
