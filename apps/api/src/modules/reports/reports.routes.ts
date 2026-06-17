import type { FastifyInstance, FastifyReply } from 'fastify';
import { prisma } from '../../lib/prisma.js';
import { badRequest } from '../../lib/errors.js';
import { requireRifero } from '../../middlewares/auth.js';
import { loadOwnedRaffle } from '../../lib/ownership.js';
import { assertFeature } from '../../lib/plan.js';
import { buildExcelStream, buildPdfTable, type ReportColumn, type ReportRow } from '../../lib/reports.js';
import { ORDER_STATUS_LABELS, TICKET_STATUS_LABELS, formatDateTimeMX } from '@bismark/shared';

type Format = 'excel' | 'pdf';

// El PDF es para imprimir/compartir; más allá de esto es ilegible y pesadísimo.
// Para volúmenes grandes el reporte correcto es Excel (se genera en streaming).
const PDF_MAX_ROWS = 5000;
const DB_CHUNK = 5000;

function getFormat(request: { query: unknown }): Format {
  const f = (request.query as { format?: string }).format;
  return f === 'pdf' ? 'pdf' : 'excel';
}

// Junta como máximo `max` filas del iterador; si hay más, corta con error claro.
async function collectForPdf(rows: AsyncIterable<ReportRow>): Promise<ReportRow[]> {
  const out: ReportRow[] = [];
  for await (const row of rows) {
    out.push(row);
    if (out.length > PDF_MAX_ROWS) {
      throw badRequest(
        `El PDF admite hasta ${PDF_MAX_ROWS.toLocaleString('es-MX')} filas. Para volúmenes grandes descarga el reporte en Excel.`,
      );
    }
  }
  return out;
}

async function deliver(
  reply: FastifyReply,
  format: Format,
  filename: string,
  title: string,
  subtitle: string,
  columns: ReportColumn[],
  rows: AsyncIterable<ReportRow>,
): Promise<FastifyReply> {
  if (format === 'excel') {
    const buf = await buildExcelStream(title, columns, rows);
    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="${filename}.xlsx"`)
      .send(buf);
  }
  const buf = await buildPdfTable(title, subtitle, columns, await collectForPdf(rows));
  return reply
    .header('Content-Type', 'application/pdf')
    .header('Content-Disposition', `attachment; filename="${filename}.pdf"`)
    .send(buf);
}

export default async function reportsRoutes(app: FastifyInstance): Promise<void> {
  // GET /reports/raffles/:id/orders?format=excel|pdf
  app.get('/reports/raffles/:id/orders', { preHandler: requireRifero }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const raffle = await loadOwnedRaffle(id, request.auth!);
    const format = getFormat(request);
    await assertFeature(raffle.riferoId, format === 'pdf' ? 'allowReportsPdf' : 'allowReportsExcel');

    // Órdenes en bloques con cursor (no se cargan todas a la vez).
    async function* rows(): AsyncGenerator<ReportRow> {
      let cursor: string | undefined;
      for (;;) {
        const batch = await prisma.order.findMany({
          where: { raffleId: id },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: DB_CHUNK,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
          include: { buyer: true, tickets: { select: { displayNumber: true }, orderBy: { number: 'asc' } } },
        });
        if (batch.length === 0) break;
        for (const o of batch) {
          yield {
            code: o.code,
            buyer: o.buyer.fullName,
            phone: o.buyer.phone,
            status: ORDER_STATUS_LABELS[o.status] ?? o.status,
            tickets: o.tickets.map((t) => t.displayNumber).join(', '),
            total: o.totalAmount,
            date: formatDateTimeMX(o.createdAt),
          };
        }
        cursor = batch[batch.length - 1]!.id;
      }
    }

    const columns: ReportColumn[] = [
      { header: 'Folio', key: 'code', width: 14 },
      { header: 'Comprador', key: 'buyer', width: 24 },
      { header: 'Teléfono', key: 'phone', width: 16 },
      { header: 'Estado', key: 'status', width: 14 },
      { header: 'Boletos', key: 'tickets', width: 30 },
      { header: 'Total', key: 'total', width: 12 },
      { header: 'Fecha', key: 'date', width: 20 },
    ];

    return deliver(reply, format, `ordenes-${raffle.eventNumber}`, `Órdenes · ${raffle.title}`, `E${raffle.eventNumber}`, columns, rows());
  });

  // GET /reports/raffles/:id/tickets?format=excel|pdf
  // Solo boletos con movimiento (apartados/pagados/reservados/ganadores): listar
  // cientos de miles de boletos disponibles vacíos no aporta y no escala.
  app.get('/reports/raffles/:id/tickets', { preHandler: requireRifero }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const raffle = await loadOwnedRaffle(id, request.auth!);
    const format = getFormat(request);
    await assertFeature(raffle.riferoId, format === 'pdf' ? 'allowReportsPdf' : 'allowReportsExcel');

    async function* rows(): AsyncGenerator<ReportRow> {
      let from = raffle.ticketStart;
      for (;;) {
        const batch = await prisma.ticketNumber.findMany({
          where: { raffleId: id, status: { not: 'AVAILABLE' }, number: { gte: from } },
          orderBy: { number: 'asc' },
          take: DB_CHUNK,
          include: {
            buyer: { select: { fullName: true, phone: true } },
            order: { select: { code: true } },
          },
        });
        if (batch.length === 0) break;
        for (const t of batch) {
          yield {
            num: t.displayNumber,
            status: TICKET_STATUS_LABELS[t.status] ?? t.status,
            buyer: t.buyer?.fullName ?? '',
            phone: t.buyer?.phone ?? '',
            code: t.order?.code ?? '',
          };
        }
        from = batch[batch.length - 1]!.number + 1;
      }
    }

    const columns: ReportColumn[] = [
      { header: 'Boleto', key: 'num', width: 12 },
      { header: 'Estado', key: 'status', width: 16 },
      { header: 'Comprador', key: 'buyer', width: 24 },
      { header: 'Teléfono', key: 'phone', width: 16 },
      { header: 'Folio', key: 'code', width: 14 },
    ];

    return deliver(reply, format, `boletos-${raffle.eventNumber}`, `Boletos · ${raffle.title}`, `E${raffle.eventNumber}`, columns, rows());
  });

  // GET /reports/raffles/:id/buyers?format=excel|pdf
  app.get('/reports/raffles/:id/buyers', { preHandler: requireRifero }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const raffle = await loadOwnedRaffle(id, request.auth!);
    const format = getFormat(request);
    await assertFeature(raffle.riferoId, format === 'pdf' ? 'allowReportsPdf' : 'allowReportsExcel');

    // Agrupa por comprador leyendo las órdenes en bloques. El mapa resultante
    // está acotado por el número de compradores reales, no por boletos.
    const byBuyer = new Map<string, { name: string; phone: string; whatsapp: string; state: string; tickets: number; paid: number }>();
    let cursor: string | undefined;
    for (;;) {
      const batch = await prisma.order.findMany({
        where: { raffleId: id, status: { in: ['PAID', 'RESERVED', 'PENDING'] } },
        orderBy: { id: 'asc' },
        take: DB_CHUNK,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        include: { buyer: true, _count: { select: { tickets: true } } },
      });
      if (batch.length === 0) break;
      for (const o of batch) {
        const k = o.buyer.id;
        const cur = byBuyer.get(k) ?? {
          name: o.buyer.fullName,
          phone: o.buyer.phone,
          whatsapp: o.buyer.whatsapp ?? '',
          state: o.buyer.state ?? '',
          tickets: 0,
          paid: 0,
        };
        cur.tickets += o._count.tickets;
        if (o.status === 'PAID') cur.paid += o.totalAmount;
        byBuyer.set(k, cur);
      }
      cursor = batch[batch.length - 1]!.id;
    }

    const columns: ReportColumn[] = [
      { header: 'Comprador', key: 'name', width: 24 },
      { header: 'Teléfono', key: 'phone', width: 16 },
      { header: 'WhatsApp', key: 'whatsapp', width: 16 },
      { header: 'Estado', key: 'state', width: 18 },
      { header: 'Boletos', key: 'tickets', width: 10 },
      { header: 'Pagado', key: 'paid', width: 12 },
    ];
    const rows: ReportRow[] = [...byBuyer.values()].map((b) => ({
      name: b.name,
      phone: b.phone,
      whatsapp: b.whatsapp,
      state: b.state,
      tickets: b.tickets,
      paid: b.paid,
    }));

    if (rows.length === 0) throw badRequest('No hay compradores para reportar todavía');
    async function* iter(): AsyncGenerator<ReportRow> {
      yield* rows;
    }
    return deliver(reply, format, `compradores-${raffle.eventNumber}`, `Compradores · ${raffle.title}`, `E${raffle.eventNumber}`, columns, iter());
  });
}
