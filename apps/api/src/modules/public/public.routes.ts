import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import { getPlanContext } from '../../lib/plan.js';
import { getRaffleStats, getPaidCounts } from '../../lib/stats.js';
import { buildTicketMap } from '../../lib/ticket-map.js';
import {
  toPublicRiferoDTO,
  toPublicRaffleSummaryDTO,
  toRaffleDTO,
  toWinnerDTO,
  riferoPaymentMethods,
} from '../../lib/serializers.js';

function parseEventNumber(raw: string): number {
  const cleaned = raw.replace(/^e/i, '');
  const n = Number(cleaned);
  if (!Number.isInteger(n) || n < 1) return NaN;
  return n;
}

// Resuelve el rifero del sitio. El frontend usa el alias "_" (sitio único);
// también se aceptan los slugs reales para no romper enlaces antiguos.
export async function findSiteProfile(raw: string) {
  const key = raw.toLowerCase().trim();
  if (key === '_' || key === '') {
    return prisma.riferoProfile.findFirst({ orderBy: { createdAt: 'asc' } });
  }
  const exact = await prisma.riferoProfile.findFirst({
    where: { OR: [{ subdomain: key }, { slug: key }] },
  });
  return exact ?? prisma.riferoProfile.findFirst({ orderBy: { createdAt: 'asc' } });
}

export default async function publicRoutes(app: FastifyInstance): Promise<void> {
  // GET /public/riferos/by-subdomain/:subdomain
  app.get('/public/riferos/by-subdomain/:subdomain', async (request) => {
    const { subdomain } = request.params as { subdomain: string };
    const profile = await findSiteProfile(subdomain);
    if (!profile || profile.status === 'DELETED') throw notFound('Esta página no existe');

    const ctx = await getPlanContext(profile.id);
    if (!ctx.hasActivePlan || profile.status === 'SUSPENDED') {
      return { active: false, publicName: profile.publicName };
    }

    const raffles = await prisma.raffle.findMany({
      where: { riferoId: profile.id, status: { in: ['PUBLISHED', 'FINISHED'] }, hidden: false },
      orderBy: { eventNumber: 'desc' },
      include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
    });
    const paidCounts = await getPaidCounts(raffles.map((r) => r.id));
    const summaries = raffles.map((r) =>
      toPublicRaffleSummaryDTO(r, paidCounts.get(r.id) ?? 0, r.images[0]?.url ?? profile.coverUrl ?? null),
    );

    // Ganadores publicados (sin datos del comprador) para la sección del perfil.
    const winners = profile.showWinners
      ? (
          await prisma.winner.findMany({
            where: { published: true, raffle: { riferoId: profile.id, allowWinnerPublication: true } },
            orderBy: [{ createdAt: 'desc' }, { position: 'asc' }],
            include: {
              ticket: { select: { displayNumber: true } },
              raffle: { select: { title: true, eventNumber: true } },
            },
            take: 12,
          })
        ).map((w) => ({
          id: w.id,
          raffleTitle: w.raffle.title,
          eventLabel: `E${w.raffle.eventNumber}`,
          position: w.position,
          ticketDisplayNumber: w.ticket.displayNumber,
          prizeDescription: w.prizeDescription ?? null,
          evidenceUrl: w.evidenceUrl ?? null,
        }))
      : [];

    return { active: true, rifero: toPublicRiferoDTO(profile, summaries), winners };
  });

  // GET /public/raffles/by-event/:subdomain/:eventNumber
  app.get('/public/raffles/by-event/:subdomain/:eventNumber', async (request) => {
    const { subdomain, eventNumber } = request.params as { subdomain: string; eventNumber: string };
    const n = parseEventNumber(eventNumber);
    if (Number.isNaN(n)) throw notFound('Evento no encontrado');

    const profile = await findSiteProfile(subdomain);
    if (!profile) throw notFound('Esta página no existe');

    const ctx = await getPlanContext(profile.id);
    if (!ctx.hasActivePlan || profile.status === 'SUSPENDED') {
      return { active: false };
    }

    const raffle = await prisma.raffle.findFirst({
      where: { riferoId: profile.id, eventNumber: n, status: { in: ['PUBLISHED', 'FINISHED'] }, hidden: false },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!raffle) throw notFound('Rifa no encontrada');

    const stats = await getRaffleStats(raffle.id, raffle.totalTickets);
    const base = toRaffleDTO(raffle, raffle.images, stats);

    // ¿El sitio recibe comprobantes en la plataforma? (el plan lo permite + el
    // perfil lo tiene activo). Si no, la página redirige a WhatsApp al apartar.
    const allowProofUpload = ctx.hasActivePlan && !!ctx.plan?.allowProofUpload && profile.allowProofUpload;

    // Ganadores: sólo si el perfil lo permite, la rifa lo permite y están publicados. Sin datos de comprador.
    let winners: ReturnType<typeof toWinnerDTO>[] = [];
    if (profile.showWinners && raffle.allowWinnerPublication) {
      const w = await prisma.winner.findMany({
        where: { raffleId: raffle.id, published: true },
        orderBy: { position: 'asc' },
        include: { ticket: true, buyer: false },
      });
      winners = w.map((x) => toWinnerDTO({ ...x, buyer: null }, false));
    }

    return {
      active: true,
      raffle: {
        ...base,
        rifero: toPublicRiferoDTO(profile, []),
        winners,
        allowProofUpload,
        paymentProfile: {
          holderName: profile.payHolderName,
          bank: profile.payBank,
          clabe: profile.payClabe,
          cardNumber: profile.payCardNumber,
          concept: profile.payConcept,
          instructions: profile.payInstructions ?? raffle.paymentInstructions,
          whatsapp: profile.payWhatsapp ?? profile.whatsapp,
          methods: riferoPaymentMethods(profile),
        },
      },
    };
  });

  // GET /public/raffles/:raffleId/ticket-map — mapa compacto de estados para la
  // cuadrícula (un carácter por boleto). Escala a 1,000,000 de boletos: viaja
  // comprimido y el cliente deriva número/displayNumber con start/format.
  app.get('/public/raffles/:raffleId/ticket-map', async (request) => {
    const { raffleId } = request.params as { raffleId: string };
    const raffle = await prisma.raffle.findUnique({ where: { id: raffleId } });
    if (!raffle || raffle.status === 'DRAFT' || raffle.hidden) throw notFound('Rifa no encontrada');
    return buildTicketMap(raffle);
  });

  // POST /public/orders/lookup — el comprador busca SUS órdenes por teléfono.
  // Devuelve sólo las órdenes de ese teléfono dentro de este rifero. El código del
  // boleto digital se expone SÓLO cuando la orden está PAGADA (de cara al comprador,
  // sólo "ve su boleto" una vez que el organizador confirmó el pago).
  app.post(
    '/public/orders/lookup',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request) => {
      const body = (request.body ?? {}) as { slug?: string; phone?: string };
      const slug = (body.slug ?? '').toLowerCase().trim();
      const phone = (body.phone ?? '').replace(/\D/g, '');
      if (phone.length < 10) {
        return { allowProofUpload: false, orders: [], paymentProfile: null };
      }

      const profile = await findSiteProfile(slug);
      if (!profile) throw notFound('Esta página no existe');

      // ¿El sitio recibe comprobantes en la plataforma? (plan lo permite + perfil
      // activo). Si no, el frontend oculta el botón de subir y manda a WhatsApp.
      const ctx = await getPlanContext(profile.id);
      const allowProofUpload = ctx.hasActivePlan && !!ctx.plan?.allowProofUpload && profile.allowProofUpload;

      const orders = await prisma.order.findMany({
        where: {
          raffle: { riferoId: profile.id },
          // Incluye vencidas/rechazadas para que el comprador vea qué pasó con su
          // apartado (antes desaparecían sin explicación).
          status: { in: ['RESERVED', 'PENDING', 'PAID', 'EXPIRED', 'REJECTED'] },
          buyer: { OR: [{ phone: { contains: phone } }, { whatsapp: { contains: phone } }] },
        },
        orderBy: { createdAt: 'desc' },
        include: {
          raffle: { select: { eventNumber: true, title: true } },
          tickets: { select: { displayNumber: true }, orderBy: { number: 'asc' } },
          digitalTicket: { select: { code: true } },
          paymentProofs: { select: { id: true } },
        },
        take: 50,
      });

      return {
        allowProofUpload,
        paymentProfile: {
          holderName: profile.payHolderName,
          bank: profile.payBank,
          clabe: profile.payClabe,
          cardNumber: profile.payCardNumber,
          concept: profile.payConcept,
          instructions: profile.payInstructions,
          whatsapp: profile.payWhatsapp ?? profile.whatsapp,
          methods: riferoPaymentMethods(profile),
        },
        orders: orders.map((o) => ({
          code: o.code,
          raffleTitle: o.raffle.title,
          eventLabel: `E${o.raffle.eventNumber}`,
          eventNumber: o.raffle.eventNumber,
          ticketNumbers: o.tickets.map((t) => t.displayNumber),
          totalAmount: o.totalAmount,
          status: o.status,
          paidAt: o.paidAt?.toISOString() ?? null,
          expiresAt: o.expiresAt?.toISOString() ?? null,
          createdAt: o.createdAt.toISOString(),
          hasProof: o.paymentProofs.length > 0,
          // Sólo pagadas exponen el boleto digital.
          digitalTicketCode: o.status === 'PAID' ? (o.digitalTicket?.code ?? null) : null,
        })),
      };
    },
  );

}
