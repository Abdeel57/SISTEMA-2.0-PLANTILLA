import { PassThrough } from 'node:stream';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { BRAND } from '@bismark/shared';

export interface ReportColumn {
  header: string;
  key: string;
  width?: number;
}

export type ReportRow = Record<string, string | number>;

// Excel en streaming (WorkbookWriter): las filas se escriben y liberan conforme
// llegan del iterador, así un reporte de cientos de miles de boletos no carga
// todo en memoria; solo se acumula el .xlsx final (comprimido).
export async function buildExcelStream(
  title: string,
  columns: ReportColumn[],
  rows: AsyncIterable<ReportRow>,
): Promise<Buffer> {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (c: Buffer) => chunks.push(c));
  const finished = new Promise<void>((resolve, reject) => {
    stream.on('end', resolve);
    stream.on('error', reject);
  });

  const wb = new ExcelJS.stream.xlsx.WorkbookWriter({ stream, useStyles: true, useSharedStrings: false });
  wb.creator = BRAND.name;
  const ws = wb.addWorksheet(title.slice(0, 28) || 'Reporte');
  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  headerRow.commit();

  for await (const row of rows) {
    ws.addRow(row).commit();
  }
  ws.commit();
  await wb.commit();
  await finished;
  return Buffer.concat(chunks);
}

export async function buildExcel(
  title: string,
  columns: ReportColumn[],
  rows: ReportRow[],
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = BRAND.name;
  const ws = wb.addWorksheet(title.slice(0, 28) || 'Reporte');

  ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 18 }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
  for (const row of rows) ws.addRow(row);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };

  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab);
}

export function buildPdfTable(
  title: string,
  subtitle: string,
  columns: ReportColumn[],
  rows: ReportRow[],
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36, layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fillColor('#1d4ed8').fontSize(18).font('Helvetica-Bold').text(title);
    doc.fillColor('#64748b').fontSize(10).font('Helvetica').text(subtitle);
    doc.moveDown(0.5);

    const pageWidth = doc.page.width - 72;
    const colWidth = pageWidth / columns.length;
    let y = doc.y + 6;

    const drawHeader = () => {
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(9);
      columns.forEach((c, i) => doc.text(c.header, 36 + i * colWidth, y, { width: colWidth - 4 }));
      y += 16;
      doc.moveTo(36, y - 4).lineTo(36 + pageWidth, y - 4).strokeColor('#cbd5e1').stroke();
    };
    drawHeader();

    doc.font('Helvetica').fontSize(8).fillColor('#334155');
    for (const row of rows) {
      if (y > doc.page.height - 50) {
        doc.addPage();
        y = 50;
        drawHeader();
        doc.font('Helvetica').fontSize(8).fillColor('#334155');
      }
      columns.forEach((c, i) => {
        doc.text(String(row[c.key] ?? ''), 36 + i * colWidth, y, { width: colWidth - 4, lineBreak: false });
      });
      y += 14;
    }

    doc.fontSize(7).fillColor('#94a3b8').text(BRAND.generatedBy, 36, doc.page.height - 28);
    doc.end();
  });
}
