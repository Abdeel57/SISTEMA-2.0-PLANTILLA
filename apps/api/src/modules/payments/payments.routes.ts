import type { FastifyInstance } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { badRequest, notFound, forbidden } from '../../lib/errors.js';
import { requireStaff } from '../../middlewares/auth.js';
import { loadAccessibleOrder } from '../../lib/ownership.js';
import { getPlanContext } from '../../lib/plan.js';
import { storage } from '../../lib/storage.js';
import { toPaymentProofDTO } from '../../lib/serializers.js';
import { ALLOWED_IMAGE_MIME, LIMITS, PaymentMethod } from '@bismark/shared';
import { logActivity } from '../../lib/activity.js';
import { sendPushToUser } from '../../lib/push.js';
import { env } from '../../config/env.js';

export default async function paymentsRoutes(app: FastifyInstance): Promise<void> {
  // POST /public/orders/:code/proof — el comprador sube su comprobante (si el plan lo permite)
  app.post(
    '/public/orders/:code/proof',
    { config: { rateLimit: { max: 15, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const { code } = request.params as { code: string };
      const order = await prisma.order.findUnique({ where: { code }, include: { raffle: true } });
      if (!order) throw notFound('Orden no encontrada');

      // El comprobante depende del plan/configuración del rifero.
      const ctx = await getPlanContext(order.raffle.riferoId);
      const profile = await prisma.riferoProfile.findUniqueOrThrow({ where: { id: order.raffle.riferoId } });
      if (!ctx.hasActivePlan || !ctx.plan?.allowProofUpload || !profile.allowProofUpload) {
        throw forbidden('Este rifero no recibe comprobantes dentro de la plataforma. Envíalo por WhatsApp.');
      }

      const file = await request.file({ limits: { fileSize: LIMITS.proofMaxBytes } });
      if (!file) throw badRequest('No se recibió ningún archivo');
      if (!(ALLOWED_IMAGE_MIME as readonly string[]).includes(file.mimetype)) {
        throw badRequest('Formato de imagen no permitido (usa JPG, PNG o WEBP)');
      }
      const buffer = await file.toBuffer();
      if (file.file.truncated || buffer.byteLength > LIMITS.proofMaxBytes) {
        throw badRequest('La imagen supera el tamaño máximo (5 MB)');
      }

      const method = ((file.fields?.method as { value?: string } | undefined)?.value ?? 'TRANSFER') as PaymentMethod;
      const stored = await storage.upload({
        buffer,
        filename: file.filename,
        mimetype: file.mimetype,
        folder: 'proofs',
      });

      const proof = await prisma.paymentProof.create({
        data: {
          orderId: order.id,
          method: (Object.values(PaymentMethod) as string[]).includes(method) ? method : 'TRANSFER',
          fileUrl: stored.url,
          status: 'PENDING',
        },
      });

      // Comprobante en revisión: la orden pasa a PENDING y se le quita expiresAt para
      // que el job de expiración NO libere los boletos mientras el rifero revisa.
      if (order.status === 'RESERVED' || order.status === 'PENDING') {
        await prisma.$transaction([
          prisma.ticketNumber.updateMany({
            where: { orderId: order.id, status: 'RESERVED' },
            data: { status: 'PENDING_PAYMENT' },
          }),
          prisma.order.update({
            where: { id: order.id },
            data: { status: 'PENDING', expiresAt: null },
          }),
        ]);
      }

      await logActivity({ type: 'PAYMENT', action: 'upload_proof', meta: { orderId: order.id }, ip: request.ip });

      // Push al rifero: hay un comprobante por revisar. Best-effort, sin await.
      void sendPushToUser(profile.userId, {
        title: 'Comprobante recibido 🧾',
        body: `Orden ${order.code}: el comprador subió su comprobante. Revísalo para confirmar.`,
        url: '/admin/ordenes',
      });

      return reply.code(201).send({ proof: toPaymentProofDTO(proof) });
    },
  );

  // GET /orders/:id/proof — staff consulta los comprobantes (vendedor: solo los suyos)
  app.get('/orders/:id/proof', { preHandler: requireStaff }, async (request) => {
    const { id } = request.params as { id: string };
    await loadAccessibleOrder(id, request.auth!);
    const proofs = await prisma.paymentProof.findMany({ where: { orderId: id }, orderBy: { uploadedAt: 'asc' } });
    return { items: proofs.map(toPaymentProofDTO) };
  });
}
