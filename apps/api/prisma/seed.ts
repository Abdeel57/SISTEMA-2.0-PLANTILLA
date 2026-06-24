// Seed single-tenant: crea (una sola vez) el usuario administrador del sitio y
// su perfil de rifero. Es idempotente y se ejecuta en cada arranque en Railway:
// si los datos ya existen NO los toca (no pisa contraseñas ni personalización).
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';

// Carga .env y, en producción, .env.production.
loadEnv();
if (process.env.NODE_ENV === 'production') {
  loadEnv({ path: fileURLToPath(new URL('../.env.production', import.meta.url)) });
}

const prisma = new PrismaClient();

const env = {
  // Credenciales iniciales del administrador (puede cambiarlas después).
  adminUser: (process.env.ADMIN_USER ?? 'Sortea').trim(),
  adminPassword: process.env.ADMIN_PASSWORD ?? 'admin123',
  // Nombre público inicial de la página (se edita desde /admin → Perfil).
  siteName: process.env.SITE_NAME ?? 'Mi Página de Rifas',
  siteSlug: (process.env.SITE_SLUG ?? 'rifas').trim().toLowerCase(),
};

// ─────────────────────────────────────────────────────────────
// Rifa base del proyecto.
// Cada copia (cada cliente) arranca con ESTA rifa ya armada: $50,000 MXN de
// premio, 30,000 boletos a $5. Aprovecha todas las funciones del panel
// (descripción enriquecida, promoción, términos, pago, cuenta regresiva y
// sorteo digital) para que el rifero solo edite los datos y publique.
// ─────────────────────────────────────────────────────────────
const BASE_RAFFLE = {
  slug: 'rifa-50-mil',
  title: 'Gran Rifa de $50,000 MXN',
  prize: '$50,000 MXN en efectivo',
  ticketPrice: 5, // $5 por boleto
  totalTickets: 30_000, // 30 mil boletos
  ticketFormat: 5, // 00001 … 30000
  // Cartel (texto enriquecido del mini editor del admin: divs con estilos en línea).
  description: [
    '<div style="font-weight:800;font-size:large;">CON TU BOLETO <span style="color:#16a34a;">PAGADO</span> PARTICIPAS POR:</div>',
    '<div style="font-weight:800;font-size:x-large;color:#16a34a;">💵 $50,000 MXN EN EFECTIVO</div>',
    '<div>Te lo entregamos por transferencia o en efectivo, como prefieras.</div>',
    '<div><br></div>',
    '<div style="font-weight:800;font-size:large;">🎯 SOLO 30,000 BOLETOS · $5 CADA UNO</div>',
    '<div>Entre menos boletos, más fácil ganar. ¡Aparta los tuyos antes de que se acaben!</div>',
    '<div><br></div>',
    '<div style="font-weight:800;font-size:large;color:#dc2626;">🔥 BONO PRONTO PAGO</div>',
    '<div>Liquida tu boleto en las primeras <span style="font-weight:800;">12 horas</span> y participas por <span style="font-weight:800;color:#16a34a;">$5,000 MXN</span> adicionales.</div>',
    '<div><br></div>',
    '<div style="font-weight:800;font-size:large;color:#7c3aed;">💎 BONO COMPRA EN GRANDE</div>',
    '<div>Aparta <span style="font-weight:800;">10 boletos o más</span> en una sola compra y te regalamos <span style="font-weight:800;">2 boletos extra</span>. ¡Más oportunidades de ganar!</div>',
    '<div><br></div>',
    '<div style="font-weight:800;font-size:large;color:#2563eb;">📲 SORTEO EN VIVO</div>',
    '<div>Transmitimos el sorteo por nuestras redes. El número ganador se define con la <span style="font-weight:700;">Lotería Nacional</span>: 100% transparente.</div>',
    '<div><br></div>',
    '<div style="font-weight:800;">¡Mucha suerte! 🍀</div>',
  ].join(''),
  terms: [
    '• Para participar, el boleto debe estar totalmente pagado antes de la fecha del sorteo.',
    '• El número ganador se determina con base en los resultados de la Lotería Nacional del día del sorteo.',
    '• El ganador será contactado por WhatsApp y publicado en esta página y en nuestras redes.',
    '• El premio se entrega en un plazo máximo de 7 días naturales una vez verificada la identidad del ganador.',
    '• Boletos no pagados dentro del tiempo de apartado se liberan automáticamente para otros compradores.',
    '• Premios no transferibles ni canjeables. La compra de un boleto implica la aceptación de estos términos.',
  ].join('\n'),
  paymentInstructions: [
    'Aparta tus boletos y realiza el pago por transferencia o depósito.',
    'Tienes 2 horas para liquidar antes de que los boletos se liberen.',
    'Envía tu comprobante por WhatsApp para confirmar tu participación. ¡Listo, ya estás dentro!',
  ].join('\n'),
  // Promoción (tira a todo lo ancho bajo el encabezado de la rifa pública).
  promoTitle: '🔥 BONO PRONTO PAGO: $5,000 EXTRA',
  promoSubtitle: 'Liquida tu boleto en las primeras 12 horas y participas por un premio adicional.',
  promoColorFrom: '#f97316',
  promoColorTo: '#dc2626',
};

// Inserta los boletos disponibles en lotes (mismo SQL que usa la app al crear
// una rifa: relleno a `format` dígitos sin truncar, idempotente por número).
async function generateTickets(raffleId: string, start: number, count: number, format: number): Promise<void> {
  const CHUNK = 50_000;
  for (let offset = 0; offset < count; offset += CHUNK) {
    const from = start + offset;
    const to = start + Math.min(offset + CHUNK, count) - 1;
    await prisma.$executeRaw`
      INSERT INTO "TicketNumber" ("id", "raffleId", "number", "displayNumber", "status", "createdAt", "updatedAt")
      SELECT
        gen_random_uuid()::text,
        ${raffleId},
        n,
        lpad(n::text, GREATEST(length(n::text), ${format}::int), '0'),
        'AVAILABLE'::"TicketStatus",
        now(),
        now()
      FROM generate_series(${from}::int, ${to}::int) AS n
      ON CONFLICT ("raffleId", "number") DO NOTHING
    `;
  }
}

// Crea la rifa base SOLO si la página todavía no tiene ninguna rifa. Así no se
// duplica en cada arranque ni pisa las rifas que el rifero ya haya creado.
async function ensureBaseRaffle(riferoId: string): Promise<void> {
  const existing = await prisma.raffle.count({ where: { riferoId } });
  if (existing > 0) {
    console.log('✓ La página ya tiene rifas; la rifa base no se modifica.');
    return;
  }

  const start = 1;
  const total = BASE_RAFFLE.totalTickets;
  const now = new Date();
  const draw = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // sorteo en ~60 días

  const raffle = await prisma.raffle.create({
    data: {
      riferoId,
      eventNumber: 1,
      title: BASE_RAFFLE.title,
      slug: BASE_RAFFLE.slug,
      prize: BASE_RAFFLE.prize,
      description: BASE_RAFFLE.description,
      ticketPrice: BASE_RAFFLE.ticketPrice,
      totalTickets: total,
      ticketFormat: BASE_RAFFLE.ticketFormat,
      ticketStart: start,
      ticketEnd: start + total - 1,
      startDate: now,
      drawDate: draw,
      status: 'PUBLISHED',
      terms: BASE_RAFFLE.terms,
      paymentInstructions: BASE_RAFFLE.paymentInstructions,
      reserveMinutes: 120,
      allowWinnerPublication: true,
      useDigitalDraw: true,
      showCountdown: true,
      promoEnabled: true,
      promoTitle: BASE_RAFFLE.promoTitle,
      promoSubtitle: BASE_RAFFLE.promoSubtitle,
      promoColorFrom: BASE_RAFFLE.promoColorFrom,
      promoColorTo: BASE_RAFFLE.promoColorTo,
    },
  });

  await generateTickets(raffle.id, start, total, BASE_RAFFLE.ticketFormat);
  console.log(
    `✅ Rifa base creada: "${BASE_RAFFLE.title}" — ${total.toLocaleString('es-MX')} boletos a $${BASE_RAFFLE.ticketPrice} (premio ${BASE_RAFFLE.prize}).`,
  );
}

async function main() {
  console.log('🌱 Preparando el sitio (single-tenant)...');

  // Si el sitio YA está configurado (existe un perfil de rifero), NO recreamos el
  // usuario ni el perfil: respetamos lo que el cliente tenga, incluido un usuario
  // renombrado (p. ej. cambiar el acceso de "bismark" a "sortea"). Buscar por el
  // PERFIL —y no por el email de ADMIN_USER— evita crear administradores
  // DUPLICADOS (un usuario huérfano sin perfil) cuando ADMIN_USER cambia entre
  // deploys. Solo aseguramos la rifa base.
  const configuredProfile = await prisma.riferoProfile.findFirst({ orderBy: { createdAt: 'asc' } });
  if (configuredProfile) {
    console.log(`✓ Sitio ya configurado: "${configuredProfile.publicName}". No se recrea usuario/perfil.`);
    await ensureBaseRaffle(configuredProfile.id);
    console.log('🌱 Listo.');
    return;
  }

  // Primer arranque (BD sin perfil): crea el usuario administrador y su perfil.
  // El "usuario" de acceso se guarda en la columna email, en minúsculas.
  const usuario = env.adminUser.toLowerCase();
  const passwordHash = await bcrypt.hash(env.adminPassword, 12);
  const user = await prisma.user.create({
    data: {
      name: env.adminUser,
      email: usuario,
      phone: '0000000000',
      passwordHash,
      role: 'RIFERO',
      status: 'ACTIVE',
    },
  });
  console.log(`✅ Usuario administrador creado: ${env.adminUser}`);

  const profile = await prisma.riferoProfile.create({
    data: {
      userId: user.id,
      publicName: env.siteName,
      slug: env.siteSlug,
      subdomain: env.siteSlug,
      whatsapp: '',
      primaryColor: '#1d4ed8',
      secondaryColor: '#0f172a',
      templateKey: 'classic',
      allowProofUpload: true, // recibir comprobantes en la plataforma desde el inicio
      status: 'ACTIVE',
      verified: true,
    },
  });
  console.log(`✅ Perfil del sitio creado: ${env.siteName}`);

  // Rifa base del proyecto (idempotente: solo si la página aún no tiene rifas).
  await ensureBaseRaffle(profile.id);

  console.log('🌱 Listo.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
