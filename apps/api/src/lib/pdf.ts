import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { formatMXN, formatDateMX, BRAND } from '@bismark/shared';

export interface DigitalTicketPdfData {
  raffleTitle: string;
  rafflePrize?: string | null;
  drawDate?: Date | null;
  riferoPublicName: string;
  eventLabel: string;
  ticketNumbers: string[];
  buyerName: string;
  buyerState?: string | null;
  statusLabel: string;
  totalAmount: number;
  orderCode: string;
  verifyUrl: string;
  createdAt: Date;
  primaryColor?: string;
  secondaryColor?: string;
  riferoVerified?: boolean;
  /** Bytes del logo del rifero (idealmente PNG/JPG). Si no se puede incrustar, se usa la inicial. */
  logo?: Buffer | null;
}

// Máximo de números que se imprimen como "chips" en el boleto. Con más, se añade
// un "+N más" para no romper el alto de la página (la lista completa vive en la web).
const MAX_CHIPS = 10;

// ── Color helpers ───────────────────────────────────────────
function isHex6(c?: string | null): c is string {
  return !!c && /^#([0-9a-f]{6})$/i.test(c);
}
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
}
const darken = (hex: string, t: number) => mix(hex, '#000000', t);
const lighten = (hex: string, t: number) => mix(hex, '#ffffff', t);
function readableOn(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#0f172a' : '#ffffff';
}

function streamToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
}

export async function renderDigitalTicketPdf(data: DigitalTicketPdfData): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A5', margin: 0, layout: 'portrait' });
  const done = streamToBuffer(doc);

  const W = doc.page.width; // ≈ 419.5
  const H = doc.page.height; // ≈ 595.3
  const PAD = 34;
  const CONTENT_W = W - PAD * 2;

  const accent = isHex6(data.primaryColor) ? data.primaryColor : '#1A4DFF';
  const accentDeep = darken(accent, 0.3);
  const onAccent = readableOn(accent);
  const ink = '#0f172a';
  const muted = '#64748b';
  const chipBg = lighten(accent, 0.86);
  const chipInk = darken(accent, 0.22);

  // ── Encabezado de marca (banda con el color del rifero) ──
  const HEADER_H = 116;
  doc.rect(0, 0, W, HEADER_H).fill(accent);
  doc.rect(0, HEADER_H - 6, W, 6).fill(accentDeep); // franja inferior con profundidad

  // Logo en placa blanca redondeada (o inicial como respaldo).
  const badge = 58;
  const badgeX = PAD;
  const badgeY = 30;
  doc.roundedRect(badgeX, badgeY, badge, badge, 15).fill('#ffffff');
  let logoDrawn = false;
  if (data.logo) {
    try {
      doc.save();
      doc.roundedRect(badgeX + 5, badgeY + 5, badge - 10, badge - 10, 10).clip();
      doc.image(data.logo, badgeX + 5, badgeY + 5, {
        fit: [badge - 10, badge - 10],
        align: 'center',
        valign: 'center',
      });
      doc.restore();
      logoDrawn = true;
    } catch {
      doc.restore();
      logoDrawn = false;
    }
  }
  if (!logoDrawn) {
    doc
      .fillColor(accent)
      .font('Helvetica-Bold')
      .fontSize(28)
      .text((data.riferoPublicName.charAt(0) || '?').toUpperCase(), badgeX, badgeY + 15, {
        width: badge,
        align: 'center',
      });
  }

  // Nombre del organizador + estado verificado + etiqueta de boleto.
  const tx = badgeX + badge + 14;
  const tw = W - tx - PAD;
  doc.fillColor(onAccent).font('Helvetica-Bold').fontSize(17).text(data.riferoPublicName, tx, 38, {
    width: tw,
    ellipsis: true,
    lineBreak: false,
  });
  if (data.riferoVerified) {
    const cy = doc.y + 9;
    const cx = tx + 7;
    doc.circle(cx, cy, 7).fill('#ffffff');
    doc.save();
    doc.lineWidth(1.6).strokeColor(accent);
    doc.moveTo(cx - 3, cy + 0.2).lineTo(cx - 0.8, cy + 2.6).lineTo(cx + 3.4, cy - 2.8).stroke();
    doc.restore();
    doc
      .fillColor(onAccent)
      .font('Helvetica-Bold')
      .fontSize(9)
      .text('Organizador verificado', cx + 11, cy - 5, { width: tw - 20, lineBreak: false });
  }
  // Píldora "BOLETO DIGITAL · E#".
  const pill = `BOLETO DIGITAL · ${data.eventLabel}`;
  doc.font('Helvetica-Bold').fontSize(8.5);
  const pillW = doc.widthOfString(pill) + 18;
  doc.roundedRect(tx, 84, pillW, 18, 9).fill(lighten(accent, 0.16));
  doc.fillColor(onAccent).text(pill, tx, 89, { width: pillW, align: 'center' });

  // ── Cuerpo ──
  let y = HEADER_H + 18;

  doc
    .fillColor(ink)
    .font('Helvetica-Bold')
    .fontSize(18)
    .text(data.raffleTitle, PAD, y, { width: CONTENT_W, height: 48, ellipsis: true });
  y = doc.y + 3;
  if (data.rafflePrize) {
    doc
      .fillColor(muted)
      .font('Helvetica')
      .fontSize(10.5)
      .text(`Premio: ${data.rafflePrize}`, PAD, y, { width: CONTENT_W, height: 14, ellipsis: true });
    y = doc.y;
  }
  y += 16;

  // Números de boleto como "chips".
  doc.fillColor(muted).font('Helvetica-Bold').fontSize(8).text('NÚMEROS DE BOLETO', PAD, y, { characterSpacing: 0.8 });
  y = doc.y + 7;
  const shown = data.ticketNumbers.slice(0, MAX_CHIPS);
  const extra = data.ticketNumbers.length - shown.length;
  const chips = extra > 0 ? [...shown, `+${extra} más`] : shown;
  const chipH = 24;
  const gap = 7;
  let cx = PAD;
  doc.font('Helvetica-Bold').fontSize(12);
  for (const num of chips) {
    const cw = doc.widthOfString(num) + 20;
    if (cx + cw > PAD + CONTENT_W) {
      cx = PAD;
      y += chipH + gap;
    }
    doc.roundedRect(cx, y, cw, chipH, 8).fill(chipBg);
    doc.fillColor(chipInk).font('Helvetica-Bold').fontSize(12).text(num, cx, y + 6, { width: cw, align: 'center' });
    cx += cw + gap;
  }
  y += chipH + 18;

  // Total destacado (a todo lo ancho).
  doc.roundedRect(PAD, y, CONTENT_W, 44, 12).fill(lighten(accent, 0.88));
  doc.fillColor(chipInk).font('Helvetica-Bold').fontSize(8.5).text('TOTAL', PAD + 16, y + 10, { characterSpacing: 0.8 });
  doc
    .fillColor(accentDeep)
    .font('Helvetica-Bold')
    .fontSize(22)
    .text(formatMXN(data.totalAmount), PAD + 16, y + 18, { width: CONTENT_W - 32 });
  y += 44 + 18;

  // Datos clave en 2 columnas.
  const colW = (CONTENT_W - 16) / 2;
  const colX2 = PAD + colW + 16;
  const cell = (x: number, label: string, value: string) => {
    doc.fillColor(muted).font('Helvetica-Bold').fontSize(7.5).text(label, x, y, { width: colW, characterSpacing: 0.6 });
    doc
      .fillColor(ink)
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(value, x, y + 11, { width: colW, height: 14, ellipsis: true, lineBreak: false });
  };
  const gridRow = (l: [string, string], r: [string, string] | null) => {
    cell(PAD, l[0], l[1]);
    if (r) cell(colX2, r[0], r[1]);
    y += 30;
  };
  gridRow(['A NOMBRE DE', data.buyerName], ['ESTADO', data.buyerState || '—']);
  gridRow(['ESTATUS', data.statusLabel], ['FOLIO', data.orderCode]);
  gridRow(['FECHA', formatDateMX(data.createdAt)], data.drawDate ? ['SORTEO', formatDateMX(data.drawDate)] : null);

  // ── Pie: perforación + QR + verificación ──
  y += 8;
  doc.circle(0, y, 8).fill('#ffffff');
  doc.circle(W, y, 8).fill('#ffffff');
  doc.save();
  doc.lineWidth(1).strokeColor('#cbd5e1').dash(3, { space: 3 });
  doc.moveTo(PAD, y).lineTo(W - PAD, y).stroke();
  doc.undash();
  doc.restore();
  y += 18;

  let bottom = y;
  try {
    const qrDataUrl = await QRCode.toDataURL(data.verifyUrl, { margin: 0, width: 240 });
    const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64');
    const qrSize = 96;
    const qrX = W - PAD - qrSize;
    doc.image(qrBuffer, qrX, y, { width: qrSize, height: qrSize });
    doc
      .fillColor(muted)
      .font('Helvetica-Bold')
      .fontSize(7)
      .text('ESCANEA PARA VERIFICAR', qrX - 8, y + qrSize + 5, { width: qrSize + 16, align: 'center' });

    // Texto a la izquierda del QR.
    const leftW = qrX - PAD - 12;
    doc.fillColor(ink).font('Helvetica-Bold').fontSize(13).text('Tu boleto participante', PAD, y + 6, { width: leftW });
    doc
      .fillColor(muted)
      .font('Helvetica')
      .fontSize(9.5)
      .text('Muestra este código el día del sorteo para validar tu participación.', PAD, doc.y + 4, { width: leftW });
    bottom = y + qrSize + 20;
  } catch {
    bottom = y + 10;
  }

  // Marca discreta al fondo.
  doc
    .fillColor('#94a3b8')
    .font('Helvetica')
    .fontSize(7.5)
    .text(BRAND.generatedBy, PAD, Math.min(bottom, H - 20), { width: CONTENT_W, align: 'center' });

  doc.end();
  return done;
}
