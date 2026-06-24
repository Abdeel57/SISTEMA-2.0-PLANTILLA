import type { FastifyInstance, FastifyRequest } from 'fastify';
import sharp from 'sharp';
import { prisma } from '../../lib/prisma.js';
import { notFound } from '../../lib/errors.js';
import { requireRifero } from '../../middlewares/auth.js';
import { loadOwnedOrder } from '../../lib/ownership.js';
import { renderDigitalTicketPdf } from '../../lib/pdf.js';
import { readAssetBytes } from '../../lib/storage.js';
import { getPlanContext } from '../../lib/plan.js';
import { riferoPaymentMethods } from '../../lib/serializers.js';
import { env } from '../../config/env.js';
import { ORDER_STATUS_LABELS } from '@bismark/shared';

const STATUS_LABEL = (s: string): string => ORDER_STATUS_LABELS[s as keyof typeof ORDER_STATUS_LABELS] ?? s;

// URL absoluta de validación (va dentro del QR del boleto). Si PUBLIC_WEB_URL no
// está definida, se infiere del host de la petición (frontend y API comparten origen).
function verifyUrl(code: string, request: FastifyRequest): string {
  const base = env.publicWebUrl || `${request.protocol}://${request.headers.host ?? ''}`;
  return `${base.replace(/\/$/, '')}/validar/${code}`;
}

const ORDER_FULL_INCLUDE = {
  raffle: { include: { rifero: true } },
  buyer: true,
  tickets: { orderBy: { number: 'asc' } as const },
  digitalTicket: true,
} as const;

// Carga la ORDEN (con relaciones) por código de boleto digital O por folio de la
// orden (BSK-XXXX). El boleto digital puede NO existir aún: solo se genera cuando
// el organizador confirma el pago. Antes de eso, el comprador ve su pago por folio.
async function loadOrderByCode(code: string) {
  const dt = await prisma.digitalTicket.findUnique({ where: { code }, select: { orderId: true } });
  if (dt) {
    return prisma.order.findUnique({ where: { id: dt.orderId }, include: ORDER_FULL_INCLUDE });
  }
  return prisma.order.findUnique({ where: { code }, include: ORDER_FULL_INCLUDE });
}

export default async function digitalTicketsRoutes(app: FastifyInstance): Promise<void> {
  // GET /tickets/digital/:code — datos del boleto digital (vista del comprador)
  app.get('/tickets/digital/:code', async (request) => {
    const { code } = request.params as { code: string };
    const o = await loadOrderByCode(code);
    if (!o) throw notFound('Boleto no encontrado');
    const profile = o.raffle.rifero;
    const dt = o.digitalTicket; // null hasta que el organizador confirme el pago

    // ¿El rifero acepta comprobantes dentro de la plataforma? (depende del plan).
    const ctx = await getPlanContext(profile.id);
    const allowProofUpload = ctx.hasActivePlan && !!ctx.plan?.allowProofUpload && profile.allowProofUpload;

    return {
      ticket: {
        // Sin boleto digital aún → mostramos el folio de la orden. El QR/PDF solo
        // existen una vez pagada (cuando se genera el boleto digital).
        code: dt?.code ?? o.code,
        raffleTitle: o.raffle.title,
        rafflePrize: o.raffle.prize ?? null,
        drawDate: o.raffle.drawDate?.toISOString() ?? null,
        riferoPublicName: profile.publicName,
        eventLabel: `E${o.raffle.eventNumber}`,
        ticketNumbers: o.tickets.map((t) => t.displayNumber),
        buyerName: o.buyer.fullName,
        status: o.status,
        totalAmount: o.totalAmount,
        createdAt: o.createdAt.toISOString(),
        pdfUrl: dt ? `/tickets/digital/${dt.code}/pdf` : null,
        verifyUrl: dt ? verifyUrl(dt.code, request) : '',
        // Marca del rifero (para mostrar la página de pago con SU identidad, no la de Bismark).
        riferoSlug: profile.slug,
        riferoLogoUrl: profile.logoUrl,
        riferoVerified: profile.verified,
        primaryColor: profile.primaryColor,
        secondaryColor: profile.secondaryColor,
        logoScale: profile.logoScale,
        logoGlow: profile.logoGlow,
        // Datos de pago para el comprador.
        orderCode: o.code,
        ticketPrice: o.raffle.ticketPrice,
        expiresAt: o.expiresAt?.toISOString() ?? null,
        allowProofUpload,
        riferoWhatsapp: profile.payWhatsapp || profile.whatsapp,
        paymentProfile: {
          holderName: profile.payHolderName,
          bank: profile.payBank,
          clabe: profile.payClabe,
          cardNumber: profile.payCardNumber,
          concept: profile.payConcept,
          instructions: profile.payInstructions ?? o.raffle.paymentInstructions,
          whatsapp: profile.payWhatsapp ?? profile.whatsapp,
          methods: riferoPaymentMethods(profile),
        },
      },
    };
  });

  // GET /tickets/digital/:code/pdf — descarga el PDF del boleto (solo si ya existe el boleto digital, es decir, pagado)
  app.get('/tickets/digital/:code/pdf', async (request, reply) => {
    const { code } = request.params as { code: string };
    const o = await loadOrderByCode(code);
    const dt = o?.digitalTicket;
    if (!o || !dt) throw notFound('Boleto no encontrado');

    // Logo del rifero para incrustar en el PDF. Se normaliza a PNG con sharp
    // (pdfkit solo admite PNG/JPG; los logos suelen ser webp). Best-effort: si
    // falla, se pasa el buffer tal cual y el PDF cae a la inicial del nombre.
    let logo = await readAssetBytes(o.raffle.rifero.logoUrl);
    if (logo) {
      try {
        logo = await sharp(logo).resize(180, 180, { fit: 'inside', withoutEnlargement: true }).png().toBuffer();
      } catch {
        /* se usa el buffer original; pdfkit lo valida y degrada si no puede */
      }
    }
    const pdf = await renderDigitalTicketPdf({
      raffleTitle: o.raffle.title,
      rafflePrize: o.raffle.prize,
      drawDate: o.raffle.drawDate,
      riferoPublicName: o.raffle.rifero.publicName,
      eventLabel: `E${o.raffle.eventNumber}`,
      ticketNumbers: o.tickets.map((t) => t.displayNumber),
      buyerName: o.buyer.fullName,
      statusLabel: STATUS_LABEL(o.status),
      totalAmount: o.totalAmount,
      orderCode: o.code,
      verifyUrl: verifyUrl(dt.code, request),
      createdAt: o.createdAt,
      primaryColor: o.raffle.rifero.primaryColor,
      secondaryColor: o.raffle.rifero.secondaryColor,
      riferoVerified: o.raffle.rifero.verified,
      logo,
    });

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="boleto-${o.code}.pdf"`)
      .send(pdf);
  });

  // GET /validar/:code — validación pública (datos mínimos, sin comprador)
  app.get('/validar/:code', async (request) => {
    const { code } = request.params as { code: string };
    // Acepta tanto el código del boleto digital como el folio de la orden.
    const order = await loadOrderByCode(code);
    if (!order) return { found: false };
    return {
      found: true,
      riferoPublicName: order.raffle.rifero.publicName,
      raffleTitle: order.raffle.title,
      eventLabel: `E${order.raffle.eventNumber}`,
      status: order.status,
      ticketNumbers: order.tickets.map((t) => t.displayNumber),
      totalAmount: order.totalAmount,
      createdAt: order.createdAt.toISOString(),
    };
  });

  // POST /orders/:id/generate-ticket — asegura que exista el boleto digital (rifero dueño)
  app.post('/orders/:id/generate-ticket', { preHandler: requireRifero }, async (request) => {
    const { id } = request.params as { id: string };
    await loadOwnedOrder(id, request.auth!);
    let dt = await prisma.digitalTicket.findUnique({ where: { orderId: id } });
    if (!dt) {
      const { newDigitalTicketCode } = await import('../../lib/codes.js');
      dt = await prisma.digitalTicket.create({ data: { orderId: id, code: newDigitalTicketCode() } });
    }
    return { code: dt.code, pdfUrl: `/tickets/digital/${dt.code}/pdf`, verifyUrl: verifyUrl(dt.code, request) };
  });
}
