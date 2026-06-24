// DTOs de respuesta de la API (lo que el backend serializa y el frontend consume).
import type {
  UserRole,
  UserStatus,
  RiferoStatus,
  PlanStatus,
  SubscriptionStatus,
  RaffleStatus,
  TicketStatus,
  OrderStatus,
  PaymentMethod,
  PaymentProofStatus,
} from './enums.js';
import type { PriceTier, PriceBundle } from './pricing.js';

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}

export interface AuthUserDTO {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  hasProfile: boolean;
  // true sólo para el DUEÑO del rifero (tiene perfil propio). Los admins extra y
  // vendedores pertenecen al rifero por membresía, no son dueños.
  isOwner: boolean;
  riferoId: string | null;
  slug: string | null;
  // Código de vendedor (solo role SELLER). Alimenta su link de venta.
  sellerCode: string | null;
}

// Métricas de ventas de un vendedor (o del propio vendedor en su panel).
export interface SellerStatsDTO {
  ordersTotal: number;
  ticketsSold: number; // boletos pagados
  revenue: number; // dinero de órdenes pagadas (MXN)
  pendingOrders: number; // RESERVED + PENDING
  paidOrders: number; // PAID
  cancelledOrders: number; // CANCELLED + REJECTED + EXPIRED
}

// Usuario interno del panel (administrador o vendedor) para "Usuarios y Roles".
export interface PanelUserDTO {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: UserRole; // RIFERO (Administrador) | SELLER (Vendedor)
  status: UserStatus;
  isOwner: boolean; // el dueño no se puede desactivar ni degradar
  sellerCode: string | null;
  createdAt: string;
  // Solo para vendedores: métricas de sus ventas.
  stats?: SellerStatsDTO | null;
}

export interface AuthResponse {
  user: AuthUserDTO;
  token?: string; // sólo si el cliente usa Bearer; con cookies httpOnly se omite
}

export interface PlanDTO {
  id: string;
  name: string;
  slug: string;
  price: number;
  priceYearly: number | null;
  currency: string;
  billingPeriod: string;
  maxActiveRaffles: number;
  maxTicketsPerRaffle: number;
  allowProofUpload: boolean;
  allowMultipleWinners: boolean;
  allowReportsExcel: boolean;
  allowReportsPdf: boolean;
  allowVerificationBadge: boolean;
  allowDigitalDraw: boolean;
  allowCustomDomainFuture: boolean;
  features: string[];
  status: PlanStatus;
  sortOrder: number;
}

export interface SubscriptionDTO {
  id: string;
  riferoId: string;
  planId: string;
  plan?: PlanDTO;
  status: SubscriptionStatus;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

// Método de pago del rifero (lista por perfil, persistida como JSON).
export interface PaymentMethodDTO {
  id: string;
  bank: string;
  holderName?: string | null;
  clabe?: string | null;
  cardNumber?: string | null;
  concept?: string | null;
  instructions?: string | null;
}

// Pregunta frecuente de la página pública (personalizable por el rifero).
export interface FaqItemDTO {
  q: string;
  a: string;
}

export interface RiferoProfileDTO {
  id: string;
  userId: string;
  publicName: string;
  slug: string;
  subdomain: string;
  customDomain: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  description: string | null;
  whatsapp: string | null;
  facebook: string | null;
  instagram: string | null;
  tiktok: string | null;
  primaryColor: string;
  secondaryColor: string;
  templateKey: string;
  logoScale: number;
  logoGlow: boolean;
  publicDarkMode: boolean; // tema oscuro de la página pública (lo elige el rifero)
  payHolderName: string | null;
  payBank: string | null;
  payClabe: string | null;
  payCardNumber: string | null;
  payConcept: string | null;
  payInstructions: string | null;
  payWhatsapp: string | null;
  paymentMethods: PaymentMethodDTO[];
  faqs: FaqItemDTO[];
  defaultReserveMinutes: number;
  allowProofUpload: boolean;
  showWinners: boolean;
  useDigitalDraw: boolean;
  status: RiferoStatus;
  verified: boolean;
  // Derivados
  hasActivePlan: boolean;
  activePlan?: PlanDTO | null;
  subscriptionStatus: SubscriptionStatus | null;
  createdAt: string;
}

// Vista pública (datos sensibles de pago omitidos según contexto)
export interface PublicRiferoDTO {
  id: string;
  publicName: string;
  slug: string;
  logoUrl: string | null;
  coverUrl: string | null;
  description: string | null;
  whatsapp: string | null;
  facebook: string | null;
  instagram: string | null;
  tiktok: string | null;
  primaryColor: string;
  secondaryColor: string;
  templateKey: string;
  logoScale: number;
  logoGlow: boolean;
  publicDarkMode: boolean; // tema oscuro de la página pública
  verified: boolean;
  faqs: FaqItemDTO[];
  raffles: PublicRaffleSummaryDTO[];
}

export interface RaffleImageDTO {
  id: string;
  url: string;
  sortOrder: number;
}

export interface RaffleDTO {
  id: string;
  riferoId: string;
  eventNumber: number;
  eventLabel: string; // "E1"
  title: string;
  slug: string;
  description: string | null;
  prize: string | null;
  ticketPrice: number;
  totalTickets: number;
  ticketFormat: number;
  ticketStart: number;
  ticketEnd: number;
  maxTicketsPerOrder: number | null;
  startDate: string | null;
  endDate: string | null;
  drawDate: string | null;
  status: RaffleStatus;
  // Visibilidad en la página pública (PUBLISHED + hidden=false = visible).
  hidden: boolean;
  terms: string | null;
  paymentInstructions: string | null;
  reserveMinutes: number;
  allowWinnerPublication: boolean;
  useDigitalDraw: boolean;
  showCountdown: boolean; // mostrar la cuenta regresiva al sorteo
  // Cuántas filas muestra la tabla de precios pública ("N boletos por $X"). Default 10.
  priceListRows: number;
  // Oportunidades por boleto (1 = sin regalos). Emisiones totales = totalTickets * opportunities.
  opportunities: number;
  // Promociones de volumen: niveles por umbral y paquetes exactos (pueden ir vacíos).
  pricingTiers: PriceTier[];
  pricingBundles: PriceBundle[];
  // Promoción/aviso: tira a todo lo ancho bajo el header de la rifa pública.
  promoEnabled: boolean;
  promoTitle: string | null;
  promoSubtitle: string | null;
  promoColorFrom: string | null; // hex; null = degradado por defecto
  promoColorTo: string | null;
  images: RaffleImageDTO[];
  // Stats
  soldCount: number; // pagados
  reservedCount: number;
  availableCount: number;
  estimatedRevenue: number;
  createdAt: string;
}

export interface PublicRaffleSummaryDTO {
  id: string;
  eventNumber: number;
  eventLabel: string;
  title: string;
  prize: string | null;
  ticketPrice: number;
  totalTickets: number;
  soldCount: number;
  coverUrl: string | null;
  status: RaffleStatus;
  drawDate: string | null;
}

export interface PublicRaffleDTO extends RaffleDTO {
  rifero: PublicRiferoDTO;
  winners: WinnerDTO[];
  // ¿El sitio recibe comprobantes dentro de la plataforma? (plan lo permite + el
  // perfil lo tiene activo). Si es false, al apartar la página redirige al
  // comprador a WhatsApp para coordinar el pago en vez de pedir el comprobante.
  allowProofUpload: boolean;
  // instrucciones de pago públicas (del perfil del rifero)
  paymentProfile: {
    holderName: string | null;
    bank: string | null;
    clabe: string | null;
    cardNumber: string | null;
    concept: string | null;
    instructions: string | null;
    whatsapp: string | null;
    methods?: PaymentMethodDTO[];
  };
}

// Boleto liviano para la cuadrícula pública (no exponer comprador)
export interface TicketLiteDTO {
  number: number;
  displayNumber: string;
  status: TicketStatus;
}

export interface TicketDTO extends TicketLiteDTO {
  id: string;
  reservedUntil: string | null;
  paidAt: string | null;
  // Sólo visible para el rifero dueño:
  buyer?: BuyerDTO | null;
  orderId?: string | null;
}

export interface BuyerDTO {
  id: string;
  fullName: string;
  phone: string;
  country: string; // ISO: 'MX' | 'US' (define la lada del WhatsApp)
  whatsapp: string | null;
  state: string | null;
}

export interface OrderDTO {
  id: string;
  code: string;
  raffleId: string;
  raffleTitle: string;
  eventLabel: string;
  buyer: BuyerDTO;
  ticketNumbers: string[]; // boletos MANUALES (elegidos), formateados
  // Boletos de REGALO (oportunidades) asignados a la orden, formateados.
  giftNumbers: string[];
  // Oportunidades por boleto vigentes al momento de la compra (1 = sin regalos).
  opportunities: number;
  totalAmount: number;
  status: OrderStatus;
  expiresAt: string | null;
  paidAt: string | null;
  hasProof: boolean;
  proof?: PaymentProofDTO | null;
  digitalTicketCode: string | null;
  // Vendedor atribuido (null = venta directa).
  seller: OrderSellerDTO | null;
  createdAt: string;
}

// Vendedor mínimo embebido en una orden (para la columna "Vendedor" del admin).
export interface OrderSellerDTO {
  id: string;
  name: string;
  sellerCode: string | null;
}

// Resumen mostrado al comprador tras apartar (sin datos de otros)
export interface OrderReceiptDTO {
  code: string;
  raffleTitle: string;
  eventLabel: string;
  ticketNumbers: string[]; // boletos elegidos (manuales)
  giftNumbers: string[]; // oportunidades de regalo
  opportunities: number; // oportunidades por boleto (1 = sin regalos)
  totalAmount: number;
  status: OrderStatus;
  expiresAt: string | null;
  digitalTicketCode: string | null;
  paymentProfile: PublicRaffleDTO['paymentProfile'];
  riferoWhatsapp: string | null;
  riferoPublicName: string;
}

export interface PaymentProofDTO {
  id: string;
  method: PaymentMethod;
  fileUrl: string;
  note: string | null;
  status: PaymentProofStatus;
  uploadedAt: string;
  reviewedAt: string | null;
}

export interface WinnerDTO {
  id: string;
  raffleId: string;
  position: number;
  prizeDescription: string | null;
  ticketDisplayNumber: string;
  published: boolean;
  evidenceUrl: string | null;
  // sólo para el rifero dueño:
  buyer?: BuyerDTO | null;
}

export interface DigitalTicketDTO {
  code: string;
  raffleTitle: string;
  rafflePrize: string | null;
  drawDate: string | null;
  riferoPublicName: string;
  eventLabel: string;
  ticketNumbers: string[];
  buyerName: string;
  status: OrderStatus;
  createdAt: string;
  totalAmount: number;
  pdfUrl: string | null;
  verifyUrl: string;
  // Marca del rifero (para la página de pago con su identidad).
  riferoSlug: string;
  riferoLogoUrl: string | null;
  riferoVerified: boolean;
  primaryColor: string;
  secondaryColor: string;
  logoScale: number;
  logoGlow: boolean;
  // Pago: folio de la orden (para subir comprobante), precio unitario, vencimiento,
  // si el rifero acepta comprobantes en la plataforma, y sus datos de pago.
  orderCode: string;
  ticketPrice: number;
  expiresAt: string | null;
  allowProofUpload: boolean;
  riferoWhatsapp: string | null;
  paymentProfile: PublicRaffleDTO['paymentProfile'];
}

export interface ValidationResultDTO {
  found: boolean;
  riferoPublicName?: string;
  raffleTitle?: string;
  eventLabel?: string;
  status?: OrderStatus;
  ticketNumbers?: string[];
  totalAmount?: number;
  createdAt?: string;
}

// Dashboard
export interface DashboardSummaryDTO {
  pendingOrders: number;
  paidOrders: number;
  totalOrders: number;
  activeRaffles: number;
  upcomingDraws: number;
  soldTickets: number;
  reservedTickets: number;
  estimatedRevenue: number;
}

// Admin
export interface AdminRiferoDTO {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  publicName: string;
  slug: string;
  status: RiferoStatus;
  verified: boolean;
  subscriptionStatus: SubscriptionStatus | null;
  activePlanName: string | null;
  raffleCount: number;
  estimatedRevenue: number;
  createdAt: string;
}

export interface AdminMetricsDTO {
  totalUsers: number;
  totalRiferos: number;
  activeRiferos: number;
  totalRaffles: number;
  publishedRaffles: number;
  totalOrders: number;
  paidOrders: number;
  estimatedGmv: number;
  activeSubscriptions: number;
  pendingSubscriptions: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
