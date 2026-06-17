// Versión single-tenant: ya no hay planes ni suscripciones de Bismark.
// Cada copia del sitio pertenece a un solo cliente y tiene TODO incluido,
// así que estas funciones conservan su firma pero siempre permiten.
import type { Plan, Subscription } from '@prisma/client';

export interface PlanContext {
  hasActivePlan: boolean;
  plan: Plan | null;
  subscription: Subscription | null;
  subscriptionStatus: Subscription['status'] | null;
}

// Plan sintético con todas las funciones activas y sin límites prácticos.
export const UNLIMITED_PLAN: Plan = {
  id: 'unlimited',
  name: 'Completo',
  slug: 'completo',
  price: 0,
  priceYearly: null,
  currency: 'MXN',
  billingPeriod: 'monthly',
  maxActiveRaffles: 1_000_000,
  maxTicketsPerRaffle: 1_000_000,
  allowProofUpload: true,
  allowMultipleWinners: true,
  allowReportsExcel: true,
  allowReportsPdf: true,
  allowVerificationBadge: true,
  allowDigitalDraw: true,
  allowCustomDomainFuture: true,
  features: [],
  status: 'ACTIVE',
  sortOrder: 0,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

export async function getPlanContext(_riferoId: string): Promise<PlanContext> {
  return { hasActivePlan: true, plan: UNLIMITED_PLAN, subscription: null, subscriptionStatus: 'ACTIVE' };
}

export async function assertActivePlan(_riferoId: string): Promise<Plan> {
  return UNLIMITED_PLAN;
}

export async function assertCanPublishRaffle(
  _riferoId: string,
  _raffleId: string,
  _totalTickets: number,
): Promise<Plan> {
  return UNLIMITED_PLAN;
}

export function assertTicketLimit(_plan: Plan, _totalTickets: number): void {
  // Sin límite de boletos por rifa.
}

export type PlanFeature =
  | 'allowProofUpload'
  | 'allowMultipleWinners'
  | 'allowReportsExcel'
  | 'allowReportsPdf'
  | 'allowVerificationBadge'
  | 'allowDigitalDraw'
  | 'allowCustomDomainFuture';

export async function assertFeature(_riferoId: string, _feature: PlanFeature): Promise<Plan> {
  return UNLIMITED_PLAN;
}
