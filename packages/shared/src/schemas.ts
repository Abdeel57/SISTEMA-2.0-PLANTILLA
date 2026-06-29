import { z } from 'zod';
import { SLUG_REGEX, RESERVED_SLUGS, LIMITS } from './constants.js';

// ── Auth ────────────────────────────────────────────────────
// El acceso es solo para el administrador del sitio: usuario + contraseña.
export const loginSchema = z.object({
  usuario: z.string().min(1, 'Escribe tu usuario').max(120),
  password: z.string().min(1, 'Escribe tu contraseña'),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ── Slug ────────────────────────────────────────────────────
export const slugSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(SLUG_REGEX, 'Solo letras, números y guiones (3-32)')
  .refine((s) => !(RESERVED_SLUGS as readonly string[]).includes(s.toLowerCase()), {
    message: 'Ese nombre está reservado, elige otro',
  });

// ── Onboarding ──────────────────────────────────────────────
const hexColor = z.string().regex(/^#([0-9a-fA-F]{6})$/, 'Color hex inválido');

// Imagen subida: acepta URL absoluta (https://… Cloudinary/S3) o ruta relativa
// servida por la API (/uploads/… del volumen local). z.string().url() rechaza la
// ruta relativa y por eso fallaba la creación de rifas con imagen.
const imageUrl = z
  .string()
  .refine((v) => /^https?:\/\//i.test(v) || v.startsWith('/uploads/'), { message: 'Imagen inválida' });

export const onboardingSchema = z.object({
  // Sección 1: datos personales
  fullName: z.string().min(2).max(120),
  email: z.string().email().toLowerCase(),
  phone: z.string().min(10).max(20),
  // Sección 2: página de rifas
  publicName: z.string().min(2, 'Nombre público requerido').max(80),
  // El subdominio NO lo configura el cliente: se deriva automáticamente de
  // publicName en el backend (slugify + sufijo único). Opcional para compat.
  slug: slugSchema.optional(),
  whatsapp: z.string().min(10).max(20),
  description: z.string().max(600).optional().or(z.literal('')),
  logoUrl: imageUrl.optional().or(z.literal('')),
  coverUrl: imageUrl.optional().or(z.literal('')),
  facebook: z.string().max(200).optional().or(z.literal('')),
  instagram: z.string().max(200).optional().or(z.literal('')),
  tiktok: z.string().max(200).optional().or(z.literal('')),
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
  templateKey: z.string().max(40).optional(),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

// Método de pago del rifero (varios por perfil; se guardan como JSON).
export const paymentMethodSchema = z.object({
  id: z.string().min(1).max(40),
  bank: z.string().min(1, 'Indica el banco o método').max(60),
  holderName: z.string().max(120).optional().or(z.literal('')),
  clabe: z.string().max(40).optional().or(z.literal('')),
  cardNumber: z.string().max(40).optional().or(z.literal('')),
  concept: z.string().max(120).optional().or(z.literal('')),
  instructions: z.string().max(500).optional().or(z.literal('')),
});
export type PaymentMethodInput = z.infer<typeof paymentMethodSchema>;

// Pregunta frecuente personalizable de la página pública.
export const faqItemSchema = z.object({
  q: z.string().min(3, 'Escribe la pregunta').max(120),
  a: z.string().min(3, 'Escribe la respuesta').max(600),
});
export type FaqItemInput = z.infer<typeof faqItemSchema>;

export const updateRiferoSchema = z.object({
  publicName: z.string().min(2).max(80).optional(),
  description: z.string().max(600).optional(),
  whatsapp: z.string().min(10).max(20).optional(),
  logoUrl: imageUrl.optional().or(z.literal('')),
  coverUrl: imageUrl.optional().or(z.literal('')),
  facebook: z.string().max(200).optional().or(z.literal('')),
  instagram: z.string().max(200).optional().or(z.literal('')),
  tiktok: z.string().max(200).optional().or(z.literal('')),
  primaryColor: hexColor.optional(),
  secondaryColor: hexColor.optional(),
  templateKey: z.string().max(40).optional(),
  logoScale: z.number().int().min(50).max(250).optional(), // % del tamaño base del logo
  logoGlow: z.boolean().optional(), // halo de color detrás del logo
  publicDarkMode: z.boolean().optional(), // tema oscuro de la página pública
  payHolderName: z.string().max(120).optional(),
  payBank: z.string().max(80).optional(),
  payClabe: z.string().max(40).optional(),
  payCardNumber: z.string().max(40).optional(),
  payConcept: z.string().max(120).optional(),
  payInstructions: z.string().max(1000).optional(),
  payWhatsapp: z.string().max(20).optional(),
  paymentMethods: z.array(paymentMethodSchema).max(6).optional(),
  faqs: z.array(faqItemSchema).max(10).optional(),
  defaultReserveMinutes: z.number().int().min(5).max(10080).optional(),
  allowProofUpload: z.boolean().optional(),
  showWinners: z.boolean().optional(),
  useDigitalDraw: z.boolean().optional(),
});
export type UpdateRiferoInput = z.infer<typeof updateRiferoSchema>;

// ── Precios por cantidad (promociones de volumen) ───────────
// Nivel: "a partir de minQty boletos, cada boleto cuesta unitPrice" (a todo el pedido).
export const priceTierSchema = z.object({
  minQty: z.number().int().min(2, 'El nivel aplica desde 2 boletos').max(1_000_000),
  unitPrice: z.number().int().min(0).max(1_000_000),
});
// Paquete: "qty boletos por price" (precio total de esa cantidad exacta).
export const priceBundleSchema = z.object({
  qty: z.number().int().min(2, 'El paquete es de 2 boletos o más').max(1_000_000),
  price: z.number().int().min(0).max(1_000_000),
});

// ── Raffles ─────────────────────────────────────────────────
// Campos base de la rifa (objeto puro para poder derivar create/update).
const raffleBaseSchema = z.object({
  title: z.string().min(2, 'Título requerido').max(120),
  // Permite HTML del mini editor (negritas, color, alineación). Saneado en el front.
  description: z.string().max(8000).optional(),
  prize: z.string().max(300).optional(),
  ticketPrice: z.number().int().min(1, 'Precio inválido').max(1000000),
  totalTickets: z.number().int().min(1).max(LIMITS.maxTicketsHardCap),
  ticketFormat: z.number().int().min(2).max(6).default(3),
  ticketStart: z.number().int().min(0).default(1),
  // Oportunidades por boleto: 1 = sin regalos (original). >1 genera (n-1)
  // números de regalo por cada boleto manual elegido.
  opportunities: z.number().int().min(1, 'Mínimo 1').max(50, 'Máximo 50').default(1),
  maxTicketsPerOrder: z.number().int().min(1).max(10000).optional(),
  startDate: z.string().datetime().optional().or(z.literal('')),
  endDate: z.string().datetime().optional().or(z.literal('')),
  drawDate: z.string().datetime().optional().or(z.literal('')),
  terms: z.string().max(4000).optional(),
  paymentInstructions: z.string().max(2000).optional(),
  reserveMinutes: z.number().int().min(5).max(10080).optional(),
  allowWinnerPublication: z.boolean().optional(),
  useDigitalDraw: z.boolean().optional(),
  showCountdown: z.boolean().optional(),
  // Filas de la tabla de precios pública ("N boletos por $X"): 1…50. Default 10.
  priceListRows: z.number().int().min(1, 'Mínimo 1').max(50, 'Máximo 50').optional(),
  // Promociones de volumen (opcionales): niveles por umbral y paquetes exactos.
  pricingTiers: z.array(priceTierSchema).max(12).optional(),
  pricingBundles: z.array(priceBundleSchema).max(12).optional(),
  images: z.array(imageUrl).max(8).optional(),
});

// Las emisiones totales (manuales × oportunidades) no superan el tope técnico.
// Aplica cuando vienen ambos valores (en update pueden faltar).
function emissionsWithinCap(d: { totalTickets?: number; opportunities?: number }): boolean {
  if (d.totalTickets === undefined || d.opportunities === undefined) return true;
  return d.totalTickets * d.opportunities <= LIMITS.maxTicketsHardCap;
}
const emissionsCapMessage: { message: string; path: (string | number)[] } = {
  message: `Las emisiones totales (boletos × oportunidades) superan el máximo de ${LIMITS.maxTicketsHardCap.toLocaleString('es-MX')}`,
  path: ['opportunities'],
};

export const createRaffleSchema = raffleBaseSchema.refine(emissionsWithinCap, emissionsCapMessage);
export type CreateRaffleInput = z.infer<typeof createRaffleSchema>;

export const updateRaffleSchema = raffleBaseSchema
  .partial()
  .extend({
    // Visibilidad en la página pública (toggle "activa / oculta").
    hidden: z.boolean().optional(),
    // Promoción/aviso de la rifa (se configura en "Promociones" del panel).
    promoEnabled: z.boolean().optional(),
    promoTitle: z.string().max(80).optional().or(z.literal('')),
    promoSubtitle: z.string().max(140).optional().or(z.literal('')),
    promoColorFrom: hexColor.optional().or(z.literal('')),
    promoColorTo: hexColor.optional().or(z.literal('')),
  })
  .refine(emissionsWithinCap, emissionsCapMessage);
export type UpdateRaffleInput = z.infer<typeof updateRaffleSchema>;

// ── Buyer / Reserva ─────────────────────────────────────────
export const buyerSchema = z.object({
  // 140 cubre nombres(60) + espacio + apellidos(60) del formulario público (máx. 121).
  fullName: z.string().min(2, 'Nombre requerido').max(140),
  phone: z.string().min(10, 'Teléfono inválido').max(20),
  // País del teléfono (ISO: MX/US); define la lada para el WhatsApp. Default MX.
  country: z.string().max(2).optional().or(z.literal('')),
  // whatsapp y state son opcionales; el formulario envía '' cuando no se llenan.
  whatsapp: z.string().max(20).optional().or(z.literal('')),
  state: z.string().max(60).optional().or(z.literal('')),
});
export type BuyerInput = z.infer<typeof buyerSchema>;

export const reserveTicketsSchema = z.object({
  buyer: buyerSchema,
  ticketNumbers: z
    .array(z.number().int().nonnegative())
    .min(1, 'Selecciona al menos un boleto')
    .max(LIMITS.maxTicketsPerOrderHardCap, `Máximo ${LIMITS.maxTicketsPerOrderHardCap} boletos por orden`),
  // Código del vendedor que refirió la compra (de su link). Opcional; si no
  // existe o está inactivo, la orden queda como venta directa.
  sellerCode: z.string().max(20).optional().or(z.literal('')),
  // Números de regalo (oportunidades) que el cliente vio sorteados al seleccionar.
  // El backend reserva los que sigan disponibles y rellena el resto al azar; si se
  // omite, los sortea él. Opcional → compatible con clientes viejos.
  giftNumbers: z.array(z.number().int().nonnegative()).max(100_000).optional(),
});
export type ReserveTicketsInput = z.infer<typeof reserveTicketsSchema>;

export const reserveManualSchema = z.object({
  ticketNumbers: z.array(z.number().int().nonnegative()).min(1).max(10000),
  note: z.string().max(200).optional(),
});

// ── Usuarios y Roles (staff del rifero) ─────────────────────
// Código de vendedor: mayúsculas alfanuméricas, 2-12 chars. Vacío = autogenerar.
export const sellerCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{2,12}$/, 'Código inválido: 2 a 12 letras o números');

// El "usuario" de acceso puede ser un correo o un alias corto (se guarda en la
// columna email, en minúsculas). Aceptamos ambos: con @ se valida como correo.
const usernameOrEmail = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, 'Mínimo 3 caracteres')
  .max(120)
  .refine((v) => !v.includes('@') || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), { message: 'Correo inválido' });

export const createPanelUserSchema = z.object({
  name: z.string().trim().min(2, 'Nombre requerido').max(120),
  email: usernameOrEmail,
  phone: z.string().max(20).optional().or(z.literal('')),
  // Vacío = el backend genera una contraseña temporal y la devuelve una vez.
  password: z.string().min(6, 'Mínimo 6 caracteres').max(72).optional().or(z.literal('')),
  role: z.enum(['RIFERO', 'SELLER']),
  // Solo para vendedores; vacío = autogenerar (VEN01, VEN02, …).
  sellerCode: sellerCodeSchema.optional().or(z.literal('')),
});
export type CreatePanelUserInput = z.infer<typeof createPanelUserSchema>;

export const updatePanelUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z.string().max(20).optional().or(z.literal('')),
  // Cambiar contraseña (opcional).
  password: z.string().min(6, 'Mínimo 6 caracteres').max(72).optional().or(z.literal('')),
  role: z.enum(['RIFERO', 'SELLER']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  sellerCode: sellerCodeSchema.optional().or(z.literal('')),
});
export type UpdatePanelUserInput = z.infer<typeof updatePanelUserSchema>;

// ── Draw / Winners ──────────────────────────────────────────
export const drawSchema = z.object({
  prizes: z
    .array(
      z.object({
        position: z.number().int().min(1).max(100),
        prizeDescription: z.string().max(300).optional(),
      }),
    )
    .min(1, 'Define al menos un premio')
    .max(100),
  allowRepeatWinner: z.boolean().optional().default(false),
});
export type DrawInput = z.infer<typeof drawSchema>;

// ── Plans (admin) ───────────────────────────────────────────
export const planSchema = z.object({
  name: z.string().min(2).max(80),
  slug: z.string().min(2).max(40),
  price: z.number().int().min(0),
  priceYearly: z.number().int().min(0).nullable().default(null),
  currency: z.string().default('MXN'),
  billingPeriod: z.string().default('monthly'),
  maxActiveRaffles: z.number().int().min(0),
  maxTicketsPerRaffle: z.number().int().min(0),
  allowProofUpload: z.boolean().default(false),
  allowMultipleWinners: z.boolean().default(false),
  allowReportsExcel: z.boolean().default(false),
  allowReportsPdf: z.boolean().default(false),
  allowVerificationBadge: z.boolean().default(false),
  allowDigitalDraw: z.boolean().default(false),
  allowCustomDomainFuture: z.boolean().default(false),
  features: z.array(z.string()).default([]),
  sortOrder: z.number().int().default(0),
});
export type PlanInput = z.infer<typeof planSchema>;

export const updatePlanSchema = planSchema.partial();

// ── Subscriptions (admin) ───────────────────────────────────
export const activateSubscriptionSchema = z.object({
  riferoId: z.string().min(1),
  planId: z.string().min(1),
  months: z.number().int().min(1).max(36).default(1),
});
export type ActivateSubscriptionInput = z.infer<typeof activateSubscriptionSchema>;
