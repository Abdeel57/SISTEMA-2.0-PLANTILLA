import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { formatTicketNumber, PLAN_SLUGS, newOrderCodeFallback } from './seed-helpers.js';

// Carga .env y, en producción, .env.production.
loadEnv();
if (process.env.NODE_ENV === 'production') {
  loadEnv({ path: fileURLToPath(new URL('../.env.production', import.meta.url)) });
}

const prisma = new PrismaClient();

// Métodos de pago del rifero demo (BBVA / OXXO / Nu).
const DEMO_PAYMENT_METHODS = [
  { id: 'demo-bbva', bank: 'BBVA', clabe: '012345678901234567', concept: 'Folio de tu orden', cardNumber: '4152313800000000', holderName: 'Carlos Demo', instructions: '' },
  { id: 'demo-oxxo', bank: 'OXXO', clabe: '', concept: 'Folio de tu orden', cardNumber: '4766840012345678', holderName: 'Carlos Demo', instructions: 'Deposita en cualquier OXXO con el número de tarjeta.' },
  { id: 'demo-nu', bank: 'Nu', clabe: '638180000012345678', concept: '', cardNumber: '', holderName: 'Carlos Demo', instructions: '' },
];

// Cartel (texto enriquecido) de la rifa demo GMC Denali (E2).
const GMC_DESCRIPTION = [
  '<div style="font-weight:800;font-size:large;">CON TU BOLETO <span style="color:#16a34a;">LIQUIDADO</span> PARTICIPAS POR:</div>',
  '<div style="font-weight:800;font-size:x-large;color:#16a34a;">🛻 GMC SIERRA DENALI 2026</div>',
  '<div style="font-weight:800;">0 KM · ROJA · ENGANCHE A TU NOMBRE</div>',
  '<div style="font-weight:800;">+ $50,000 MXN EN EFECTIVO</div>',
  '<div><br></div>',
  '<div style="font-weight:700;">DEL 2DO AL 10MO LUGAR</div>',
  '<div style="font-weight:800;color:#16a34a;font-size:large;">$5,000 MXN CADA UNO</div>',
  '<div><br></div>',
  '<div style="font-weight:800;font-size:large;color:#dc2626;">🔥 BONO PRONTO PAGO</div>',
  '<div>te llevas <span style="font-weight:800;color:#16a34a;">$30,000 MXN</span> extra si liquidas</div>',
  '<div>tu boleto antes de 12 hrs de apartado</div>',
  '<div><br></div>',
  '<div style="font-weight:800;font-size:large;color:#7c3aed;">💎 BONO DENALI $100,000 MXN</div>',
  '<div>comprando más de 10 boletos en una sola exhibición</div>',
  '<div style="font-weight:700;">¡NO DESPRECIES TUS BOLETOS!</div>',
].join('');

// Las imágenes del demo (logo/portada) se sirven empaquetadas en /demo-assets/
// (ver app.ts), por eso las URLs apuntan ahí y no al volumen de /uploads.
const DEMO_LOGO_URL = '/demo-assets/logos/demo-rifasdelasuerte-logo.png';
const DEMO_GMC_COVER_URL = '/demo-assets/covers/demo-gmc-2026.jpg';

const env = {
  adminEmail: process.env.SEED_ADMIN_EMAIL ?? 'admin@bismark.com',
  adminPassword: process.env.SEED_ADMIN_PASSWORD ?? 'Admin1234!',
  adminName: process.env.SEED_ADMIN_NAME ?? 'Super Admin Bismark',
  riferoEmail: process.env.SEED_RIFERO_EMAIL ?? 'demo@bismark.com',
  riferoPassword: process.env.SEED_RIFERO_PASSWORD ?? 'Demo1234!',
};

async function main() {
  console.log('🌱 Sembrando datos de Bismark...');

  // ── Planes ────────────────────────────────────────────────
  const basico = await prisma.plan.upsert({
    where: { slug: PLAN_SLUGS.BASIC },
    update: {},
    create: {
      name: 'Plan Básico',
      slug: PLAN_SLUGS.BASIC,
      price: 499,
      currency: 'MXN',
      billingPeriod: 'monthly',
      maxActiveRaffles: 1,
      maxTicketsPerRaffle: 500,
      allowProofUpload: false,
      allowMultipleWinners: false,
      allowReportsExcel: false,
      allowReportsPdf: false,
      allowVerificationBadge: false,
      allowDigitalDraw: false,
      allowCustomDomainFuture: false,
      sortOrder: 1,
      features: [
        '1 rifa activa',
        'Hasta 500 boletos por rifa',
        'Página personalizada',
        'Subdominio tunombre.bismark.com',
        'Selección visual de boletos',
        'Pagos manuales',
        'Boleto digital descargable',
        'Instrucciones de pago personalizadas',
        'Tiempo de apartado configurable',
        'Marca discreta "Impulsado por Bismark"',
      ],
    },
  });

  const pro = await prisma.plan.upsert({
    where: { slug: PLAN_SLUGS.PRO },
    update: {},
    create: {
      name: 'Plan Pro',
      slug: PLAN_SLUGS.PRO,
      price: 999,
      currency: 'MXN',
      billingPeriod: 'monthly',
      maxActiveRaffles: 5,
      maxTicketsPerRaffle: 3000,
      allowProofUpload: true,
      allowMultipleWinners: true,
      allowReportsExcel: true,
      allowReportsPdf: true,
      allowVerificationBadge: false,
      allowDigitalDraw: false,
      allowCustomDomainFuture: false,
      sortOrder: 2,
      features: [
        'Hasta 5 rifas activas',
        'Hasta 3,000 boletos por rifa',
        'Página personalizada avanzada',
        'Subida de comprobantes',
        'Varios ganadores',
        'Reportes en Excel y PDF',
        'Reservar boletos manualmente',
        'Mensajes prellenados para WhatsApp',
        'Boleto digital descargable',
        'Soporte prioritario',
      ],
    },
  });

  const verificado = await prisma.plan.upsert({
    where: { slug: PLAN_SLUGS.VERIFIED },
    update: {},
    create: {
      name: 'Plan Verificado',
      slug: PLAN_SLUGS.VERIFIED,
      price: 1999,
      currency: 'MXN',
      billingPeriod: 'monthly',
      maxActiveRaffles: 15,
      maxTicketsPerRaffle: 10000,
      allowProofUpload: true,
      allowMultipleWinners: true,
      allowReportsExcel: true,
      allowReportsPdf: true,
      allowVerificationBadge: true,
      allowDigitalDraw: true,
      allowCustomDomainFuture: true,
      sortOrder: 3,
      features: [
        'Hasta 15 rifas activas',
        'Hasta 10,000 boletos por rifa',
        'Palomita azul de verificación',
        'Subida de comprobantes',
        'Varios ganadores',
        'Reportes en Excel y PDF',
        'Tómbola digital',
        'Publicación opcional de ganadores',
        'Mayor personalización visual',
        'Opción futura de dominio personalizado',
        'Insignia "Rifero verificado"',
      ],
    },
  });

  console.log('✓ Planes:', basico.name, pro.name, verificado.name);

  // ── Super admin ───────────────────────────────────────────
  const adminHash = await bcrypt.hash(env.adminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: env.adminEmail },
    update: { role: 'SUPER_ADMIN' },
    create: {
      name: env.adminName,
      email: env.adminEmail,
      phone: '5550000000',
      passwordHash: adminHash,
      role: 'SUPER_ADMIN',
    },
  });
  console.log('✓ Super admin:', admin.email);

  // ── Rifero demo ───────────────────────────────────────────
  const riferoHash = await bcrypt.hash(env.riferoPassword, 12);
  const riferoUser = await prisma.user.upsert({
    where: { email: env.riferoEmail },
    update: {},
    create: {
      name: 'Carlos Demo',
      email: env.riferoEmail,
      phone: '5551234567',
      passwordHash: riferoHash,
      role: 'RIFERO',
    },
  });

  const profile = await prisma.riferoProfile.upsert({
    where: { userId: riferoUser.id },
    // El demo refresca su marca al re-sembrar (verde + logo de demostración).
    update: {
      primaryColor: '#16a34a',
      secondaryColor: '#052e16',
      logoUrl: DEMO_LOGO_URL,
      logoScale: 200,
      logoGlow: true,
      paymentMethods: DEMO_PAYMENT_METHODS,
    },
    create: {
      userId: riferoUser.id,
      publicName: 'Rifas de la Suerte',
      slug: 'rifasdelasuerte',
      subdomain: 'rifasdelasuerte',
      logoUrl: DEMO_LOGO_URL,
      description: 'Las mejores rifas del norte. ¡Participa y gana premios increíbles cada semana!',
      whatsapp: '5551234567',
      facebook: 'https://facebook.com/rifasdelasuerte',
      instagram: 'https://instagram.com/rifasdelasuerte',
      primaryColor: '#16a34a',
      secondaryColor: '#052e16',
      templateKey: 'classic',
      logoScale: 200,
      logoGlow: true,
      payHolderName: 'Carlos Demo',
      payBank: 'BBVA',
      payClabe: '012345678901234567',
      payCardNumber: '4152 3138 0000 0000',
      payConcept: 'Folio de tu orden',
      payInstructions: 'Realiza tu transferencia o depósito y envía tu comprobante por WhatsApp con tu folio.',
      payWhatsapp: '5551234567',
      paymentMethods: DEMO_PAYMENT_METHODS,
      defaultReserveMinutes: 120,
      allowProofUpload: true,
      showWinners: true,
      useDigitalDraw: true,
      status: 'ACTIVE',
      verified: true,
    },
  });
  console.log('✓ Rifero demo:', profile.slug);

  // Suscripción activa (Plan Verificado).
  const existingSub = await prisma.subscription.findFirst({ where: { riferoId: profile.id, status: 'ACTIVE' } });
  if (!existingSub) {
    const now = new Date();
    const endsAt = new Date(now);
    endsAt.setMonth(endsAt.getMonth() + 1);
    await prisma.subscription.create({
      data: { riferoId: profile.id, planId: verificado.id, status: 'ACTIVE', startsAt: now, endsAt },
    });
    console.log('✓ Suscripción activa: Plan Verificado');
  }

  // ── Rifa demo (E1) ────────────────────────────────────────
  const existingRaffle = await prisma.raffle.findFirst({ where: { riferoId: profile.id, eventNumber: 1 } });
  if (!existingRaffle) {
    const total = 100;
    const price = 50;
    const drawDate = new Date();
    drawDate.setDate(drawDate.getDate() + 14);

    const raffle = await prisma.raffle.create({
      data: {
        riferoId: profile.id,
        eventNumber: 1,
        title: 'iPhone 15 Pro Max 256GB',
        slug: 'iphone-15-pro-max-256gb',
        description: 'Gana el iPhone más reciente. Sorteo con la Lotería Nacional. ¡Sólo 100 boletos!',
        prize: 'iPhone 15 Pro Max 256GB Titanio Natural',
        ticketPrice: price,
        totalTickets: total,
        ticketFormat: 3,
        ticketStart: 1,
        ticketEnd: total,
        drawDate,
        status: 'PUBLISHED',
        terms: 'El sorteo se realizará con base en los últimos dígitos de la Lotería Nacional. Boleto pagado = boleto participante.',
        paymentInstructions: profile.payInstructions,
        reserveMinutes: 120,
        allowWinnerPublication: true,
        useDigitalDraw: true,
      },
    });

    // Generar boletos.
    const ticketData = Array.from({ length: total }, (_, i) => ({
      raffleId: raffle.id,
      number: i + 1,
      displayNumber: formatTicketNumber(i + 1, 3),
    }));
    await prisma.ticketNumber.createMany({ data: ticketData });

    // Orden PAGADA (boletos 1-10).
    const buyerPaid = await prisma.buyer.create({
      data: { fullName: 'María López', phone: '5559876543', whatsapp: '5559876543', state: 'Nuevo León' },
    });
    const paidNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const orderPaid = await prisma.order.create({
      data: {
        code: newOrderCodeFallback('PAID01'),
        raffleId: raffle.id,
        buyerId: buyerPaid.id,
        totalAmount: paidNumbers.length * price,
        status: 'PAID',
        paidAt: new Date(),
      },
    });
    const paidTickets = await prisma.ticketNumber.findMany({ where: { raffleId: raffle.id, number: { in: paidNumbers } } });
    await prisma.ticketNumber.updateMany({
      where: { id: { in: paidTickets.map((t) => t.id) } },
      data: { status: 'PAID', orderId: orderPaid.id, buyerId: buyerPaid.id, paidAt: new Date() },
    });
    await prisma.orderTicket.createMany({ data: paidTickets.map((t) => ({ orderId: orderPaid.id, ticketId: t.id })) });
    await prisma.digitalTicket.create({ data: { orderId: orderPaid.id, code: newOrderCodeFallback('TKTPAID1') } });

    // Orden APARTADA (boletos 20-24).
    const buyerRes = await prisma.buyer.create({
      data: { fullName: 'Juan Pérez', phone: '5552223344', whatsapp: '5552223344', state: 'Jalisco' },
    });
    const resNumbers = [20, 21, 22, 23, 24];
    const expiresAt = new Date(Date.now() + 120 * 60_000);
    const orderRes = await prisma.order.create({
      data: {
        code: newOrderCodeFallback('RES001'),
        raffleId: raffle.id,
        buyerId: buyerRes.id,
        totalAmount: resNumbers.length * price,
        status: 'RESERVED',
        expiresAt,
      },
    });
    const resTickets = await prisma.ticketNumber.findMany({ where: { raffleId: raffle.id, number: { in: resNumbers } } });
    await prisma.ticketNumber.updateMany({
      where: { id: { in: resTickets.map((t) => t.id) } },
      data: { status: 'RESERVED', orderId: orderRes.id, buyerId: buyerRes.id, reservedUntil: expiresAt },
    });
    await prisma.orderTicket.createMany({ data: resTickets.map((t) => ({ orderId: orderRes.id, ticketId: t.id })) });
    await prisma.digitalTicket.create({ data: { orderId: orderRes.id, code: newOrderCodeFallback('TKTRES01') } });

    console.log('✓ Rifa demo E1 creada con 100 boletos (10 pagados, 5 apartados)');
  }

  // ── Rifa demo (E2) — GMC Denali, la rifa estrella del demo ─
  const existingE2 = await prisma.raffle.findFirst({ where: { riferoId: profile.id, eventNumber: 2 } });
  if (!existingE2) {
    const totalE2 = 9999;
    const priceE2 = 200;
    const drawE2 = new Date();
    drawE2.setDate(drawE2.getDate() + 30);

    const gmc = await prisma.raffle.create({
      data: {
        riferoId: profile.id,
        eventNumber: 2,
        title: 'GMC Denali 2026',
        slug: 'camioneta-2024',
        description: GMC_DESCRIPTION,
        prize: 'GMC Sierra Denali 2026',
        ticketPrice: priceE2,
        totalTickets: totalE2,
        ticketFormat: 4,
        ticketStart: 1,
        ticketEnd: totalE2,
        drawDate: drawE2,
        status: 'PUBLISHED',
        paymentInstructions: profile.payInstructions,
        reserveMinutes: 120,
        allowWinnerPublication: true,
        useDigitalDraw: true,
        images: { create: [{ url: DEMO_GMC_COVER_URL, sortOrder: 0 }] },
      },
    });

    // Generar los 9,999 boletos disponibles en lotes.
    const allE2 = Array.from({ length: totalE2 }, (_, i) => ({
      raffleId: gmc.id,
      number: i + 1,
      displayNumber: formatTicketNumber(i + 1, 4),
    }));
    const BATCH = 2000;
    for (let s = 0; s < allE2.length; s += BATCH) {
      await prisma.ticketNumber.createMany({ data: allE2.slice(s, s + BATCH) });
    }
    console.log(`✓ Rifa demo E2 (GMC Denali 2026) creada con ${totalE2} boletos`);
  }

  // ── Settings globales ─────────────────────────────────────
  await prisma.platformSettings.upsert({
    where: { key: 'general' },
    update: {},
    create: {
      key: 'general',
      value: { supportEmail: 'soporte@bismark.com', supportWhatsapp: '5550000000' },
    },
  });

  console.log('\n✅ Seed completado.');
  console.log(`   Admin:  ${env.adminEmail} / ${env.adminPassword}`);
  console.log(`   Rifero: ${env.riferoEmail} / ${env.riferoPassword}`);
  console.log('   Página demo (local): /r/rifasdelasuerte');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
