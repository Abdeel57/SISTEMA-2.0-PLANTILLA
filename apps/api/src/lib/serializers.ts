// Mapean modelos Prisma -> DTOs de @bismark/shared. Mantener alineado con types.ts.
import {
  eventLabel,
  formatTicketNumber,
  type AuthUserDTO,
  type FaqItemDTO,
  type PlanDTO,
  type RiferoProfileDTO,
  type PublicRiferoDTO,
  type RaffleDTO,
  type PublicRaffleSummaryDTO,
  type BuyerDTO,
  type OrderDTO,
  type WinnerDTO,
  type RaffleImageDTO,
  type PaymentProofDTO,
  type PaymentMethodDTO,
  type PriceTier,
  type PriceBundle,
} from '@bismark/shared';
import type {
  User,
  RiferoProfile,
  Plan,
  Raffle,
  RaffleImage,
  Buyer,
  Order,
  Winner,
  TicketNumber,
  PaymentProof,
  DigitalTicket,
  Subscription,
} from '@prisma/client';

const iso = (d: Date | null | undefined): string | null => (d ? d.toISOString() : null);

export function toAuthUserDTO(user: User, profile?: RiferoProfile | null): AuthUserDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone ?? null,
    role: user.role,
    status: user.status,
    hasProfile: !!profile,
    isOwner: !!profile,
    // El dueño deriva su rifero del perfil; el staff, de su membresía.
    riferoId: profile?.id ?? user.memberOfRiferoId ?? null,
    slug: profile?.slug ?? null,
    sellerCode: user.sellerCode ?? null,
  };
}

export function toPlanDTO(plan: Plan): PlanDTO {
  return {
    id: plan.id,
    name: plan.name,
    slug: plan.slug,
    price: plan.price,
    priceYearly: plan.priceYearly,
    currency: plan.currency,
    billingPeriod: plan.billingPeriod,
    maxActiveRaffles: plan.maxActiveRaffles,
    maxTicketsPerRaffle: plan.maxTicketsPerRaffle,
    allowProofUpload: plan.allowProofUpload,
    allowMultipleWinners: plan.allowMultipleWinners,
    allowReportsExcel: plan.allowReportsExcel,
    allowReportsPdf: plan.allowReportsPdf,
    allowVerificationBadge: plan.allowVerificationBadge,
    allowDigitalDraw: plan.allowDigitalDraw,
    allowCustomDomainFuture: plan.allowCustomDomainFuture,
    features: Array.isArray(plan.features) ? (plan.features as string[]) : [],
    status: plan.status,
    sortOrder: plan.sortOrder,
  };
}

export interface PlanCtxLite {
  hasActivePlan: boolean;
  plan: Plan | null;
  subscriptionStatus: Subscription['status'] | null;
}

// Preguntas frecuentes personalizadas del rifero (lista JSON de {q, a}).
// Vacía = el frontend muestra las DEFAULT_FAQS.
export function riferoFaqs(p: RiferoProfile): FaqItemDTO[] {
  const raw = p.faqs;
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).filter(
    (f): f is FaqItemDTO =>
      !!f && typeof f === 'object' && typeof (f as FaqItemDTO).q === 'string' && typeof (f as FaqItemDTO).a === 'string',
  );
}

// Métodos de pago del rifero: lista JSON; si está vacía, sintetiza uno con los
// campos pay* legados para que los perfiles existentes sigan mostrando su tarjeta.
export function riferoPaymentMethods(p: RiferoProfile): PaymentMethodDTO[] {
  const raw = p.paymentMethods;
  if (Array.isArray(raw) && raw.length > 0) {
    return (raw as unknown[]).filter(
      (m): m is PaymentMethodDTO => !!m && typeof m === 'object' && typeof (m as PaymentMethodDTO).bank === 'string',
    );
  }
  if (p.payBank || p.payClabe || p.payCardNumber || p.payHolderName) {
    return [
      {
        id: 'legacy',
        bank: p.payBank ?? 'Transferencia',
        holderName: p.payHolderName ?? null,
        clabe: p.payClabe ?? null,
        cardNumber: p.payCardNumber ?? null,
        concept: p.payConcept ?? null,
        instructions: null,
      },
    ];
  }
  return [];
}

export function toRiferoProfileDTO(p: RiferoProfile, ctx: PlanCtxLite): RiferoProfileDTO {
  return {
    id: p.id,
    userId: p.userId,
    publicName: p.publicName,
    slug: p.slug,
    subdomain: p.subdomain,
    customDomain: p.customDomain ?? null,
    logoUrl: p.logoUrl ?? null,
    coverUrl: p.coverUrl ?? null,
    description: p.description ?? null,
    whatsapp: p.whatsapp ?? null,
    facebook: p.facebook ?? null,
    instagram: p.instagram ?? null,
    tiktok: p.tiktok ?? null,
    primaryColor: p.primaryColor,
    secondaryColor: p.secondaryColor,
    templateKey: p.templateKey,
    logoScale: p.logoScale,
    logoGlow: p.logoGlow,
    publicDarkMode: p.publicDarkMode,
    payHolderName: p.payHolderName ?? null,
    payBank: p.payBank ?? null,
    payClabe: p.payClabe ?? null,
    payCardNumber: p.payCardNumber ?? null,
    payConcept: p.payConcept ?? null,
    payInstructions: p.payInstructions ?? null,
    payWhatsapp: p.payWhatsapp ?? null,
    paymentMethods: riferoPaymentMethods(p),
    faqs: riferoFaqs(p),
    defaultReserveMinutes: p.defaultReserveMinutes,
    allowProofUpload: p.allowProofUpload,
    autoReleaseExpired: p.autoReleaseExpired,
    showWinners: p.showWinners,
    useDigitalDraw: p.useDigitalDraw,
    status: p.status,
    verified: p.verified,
    hasActivePlan: ctx.hasActivePlan,
    activePlan: ctx.plan ? toPlanDTO(ctx.plan) : null,
    subscriptionStatus: ctx.subscriptionStatus,
    createdAt: p.createdAt.toISOString(),
  };
}

export interface RaffleStats {
  soldCount: number; // PAID
  reservedCount: number; // RESERVED + PENDING_PAYMENT
  availableCount: number;
}

export function toRaffleImageDTO(img: RaffleImage): RaffleImageDTO {
  return { id: img.id, url: img.url, sortOrder: img.sortOrder };
}

// Precios por cantidad guardados como JSON en la rifa. Filtran formas inválidas.
export function rafflePricingTiers(r: Raffle): PriceTier[] {
  const raw = r.pricingTiers;
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).filter(
    (t): t is PriceTier =>
      !!t &&
      typeof t === 'object' &&
      typeof (t as PriceTier).minQty === 'number' &&
      typeof (t as PriceTier).unitPrice === 'number',
  );
}

export function rafflePricingBundles(r: Raffle): PriceBundle[] {
  const raw = r.pricingBundles;
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).filter(
    (b): b is PriceBundle =>
      !!b &&
      typeof b === 'object' &&
      typeof (b as PriceBundle).qty === 'number' &&
      typeof (b as PriceBundle).price === 'number',
  );
}

export function toRaffleDTO(raffle: Raffle, images: RaffleImage[], stats: RaffleStats): RaffleDTO {
  return {
    id: raffle.id,
    riferoId: raffle.riferoId,
    eventNumber: raffle.eventNumber,
    eventLabel: eventLabel(raffle.eventNumber),
    title: raffle.title,
    slug: raffle.slug,
    description: raffle.description ?? null,
    prize: raffle.prize ?? null,
    ticketPrice: raffle.ticketPrice,
    totalTickets: raffle.totalTickets,
    ticketFormat: raffle.ticketFormat,
    ticketStart: raffle.ticketStart,
    ticketEnd: raffle.ticketEnd,
    maxTicketsPerOrder: raffle.maxTicketsPerOrder ?? null,
    startDate: iso(raffle.startDate),
    endDate: iso(raffle.endDate),
    drawDate: iso(raffle.drawDate),
    status: raffle.status,
    hidden: raffle.hidden,
    terms: raffle.terms ?? null,
    paymentInstructions: raffle.paymentInstructions ?? null,
    reserveMinutes: raffle.reserveMinutes,
    allowWinnerPublication: raffle.allowWinnerPublication,
    useDigitalDraw: raffle.useDigitalDraw,
    showCountdown: raffle.showCountdown,
    priceListRows: raffle.priceListRows,
    opportunities: raffle.opportunities,
    pricingTiers: rafflePricingTiers(raffle),
    pricingBundles: rafflePricingBundles(raffle),
    promoEnabled: raffle.promoEnabled,
    promoTitle: raffle.promoTitle ?? null,
    promoSubtitle: raffle.promoSubtitle ?? null,
    promoColorFrom: raffle.promoColorFrom ?? null,
    promoColorTo: raffle.promoColorTo ?? null,
    images: images.map(toRaffleImageDTO),
    soldCount: stats.soldCount,
    reservedCount: stats.reservedCount,
    availableCount: stats.availableCount,
    estimatedRevenue: stats.soldCount * raffle.ticketPrice,
    createdAt: raffle.createdAt.toISOString(),
  };
}

export function toPublicRaffleSummaryDTO(
  raffle: Raffle,
  soldCount: number,
  coverUrl: string | null,
): PublicRaffleSummaryDTO {
  return {
    id: raffle.id,
    eventNumber: raffle.eventNumber,
    eventLabel: eventLabel(raffle.eventNumber),
    title: raffle.title,
    prize: raffle.prize ?? null,
    ticketPrice: raffle.ticketPrice,
    totalTickets: raffle.totalTickets,
    soldCount,
    coverUrl,
    status: raffle.status,
    drawDate: iso(raffle.drawDate),
  };
}

export function toPublicRiferoDTO(p: RiferoProfile, raffles: PublicRaffleSummaryDTO[]): PublicRiferoDTO {
  return {
    id: p.id,
    publicName: p.publicName,
    slug: p.slug,
    logoUrl: p.logoUrl ?? null,
    coverUrl: p.coverUrl ?? null,
    description: p.description ?? null,
    whatsapp: p.whatsapp ?? null,
    facebook: p.facebook ?? null,
    instagram: p.instagram ?? null,
    tiktok: p.tiktok ?? null,
    primaryColor: p.primaryColor,
    secondaryColor: p.secondaryColor,
    templateKey: p.templateKey,
    logoScale: p.logoScale,
    logoGlow: p.logoGlow,
    publicDarkMode: p.publicDarkMode,
    verified: p.verified,
    faqs: riferoFaqs(p),
    raffles,
  };
}

export function toBuyerDTO(b: Buyer): BuyerDTO {
  return {
    id: b.id,
    fullName: b.fullName,
    phone: b.phone,
    country: b.country ?? 'MX',
    whatsapp: b.whatsapp ?? null,
    state: b.state ?? null,
  };
}

export function toPaymentProofDTO(pp: PaymentProof): PaymentProofDTO {
  return {
    id: pp.id,
    method: pp.method,
    fileUrl: pp.fileUrl,
    note: pp.note ?? null,
    status: pp.status,
    uploadedAt: pp.uploadedAt.toISOString(),
    reviewedAt: iso(pp.reviewedAt),
  };
}

export type OrderWithRelations = Order & {
  raffle: Raffle;
  buyer: Buyer;
  tickets: TicketNumber[];
  paymentProofs?: PaymentProof[];
  digitalTicket?: DigitalTicket | null;
  seller?: Pick<User, 'id' | 'name' | 'sellerCode'> | null;
};

export function toOrderDTO(o: OrderWithRelations): OrderDTO {
  const sortedTickets = [...o.tickets].sort((a, b) => a.number - b.number);
  // Separa boletos elegidos (manuales) de los de regalo (oportunidades).
  const manual = sortedTickets.filter((t) => !t.isGift).map((t) => t.displayNumber);
  const gifts = sortedTickets.filter((t) => t.isGift).map((t) => t.displayNumber);
  const latestProof = o.paymentProofs && o.paymentProofs.length > 0 ? o.paymentProofs[o.paymentProofs.length - 1] : null;
  return {
    id: o.id,
    code: o.code,
    raffleId: o.raffleId,
    raffleTitle: o.raffle.title,
    eventLabel: eventLabel(o.raffle.eventNumber),
    buyer: toBuyerDTO(o.buyer),
    ticketNumbers: manual,
    giftNumbers: gifts,
    opportunities: o.raffle.opportunities,
    totalAmount: o.totalAmount,
    status: o.status,
    expiresAt: iso(o.expiresAt),
    paidAt: iso(o.paidAt),
    paymentMethod: o.paymentMethod ?? null,
    paymentNote: o.paymentNote ?? null,
    hasProof: !!latestProof,
    proof: latestProof ? toPaymentProofDTO(latestProof) : null,
    digitalTicketCode: o.digitalTicket?.code ?? null,
    seller: o.seller ? { id: o.seller.id, name: o.seller.name, sellerCode: o.seller.sellerCode ?? null } : null,
    createdAt: o.createdAt.toISOString(),
  };
}

export function toWinnerDTO(
  w: Winner & { ticket: TicketNumber; buyer?: Buyer | null },
  includeBuyer: boolean,
): WinnerDTO {
  return {
    id: w.id,
    raffleId: w.raffleId,
    position: w.position,
    prizeDescription: w.prizeDescription ?? null,
    ticketDisplayNumber: w.ticket.displayNumber,
    published: w.published,
    evidenceUrl: w.evidenceUrl ?? null,
    buyer: includeBuyer && w.buyer ? toBuyerDTO(w.buyer) : undefined,
  };
}

// Util: formatea boletos a su displayNumber dado el formato de la rifa.
export function formatTickets(numbers: number[], padding: number): string[] {
  return [...numbers].sort((a, b) => a - b).map((n) => formatTicketNumber(n, padding));
}
