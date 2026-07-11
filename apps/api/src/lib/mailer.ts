// Envío de correos transaccionales (recuperación de contraseña, avisos de órdenes).
//
// Driver-agnóstico:
//   - `log`    → imprime el correo en consola (dev local, sin cuenta de correo).
//   - `resend` → envía por la API HTTP de Resend (https://resend.com), sin SDK.
//
// El driver se elige por env (EMAIL_DRIVER) o se infiere: `resend` si hay
// RESEND_API_KEY, de lo contrario `log`. El envío NUNCA lanza: un fallo de
// correo no debe romper el flujo principal (registrar orden, etc.).

import { env } from '../config/env.js';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

const BRAND = 'Bismark';

// ── Utilidades ──────────────────────────────────────────────
// Escapa texto para insertarlo de forma segura en HTML (evita inyección).
export function escapeHtml(value: string | null | undefined): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Quita etiquetas para derivar una versión texto plano a partir del HTML.
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ── Plantilla branded ───────────────────────────────────────
interface LayoutOptions {
  title: string;
  intro: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footnote?: string;
}

export function renderBrandedEmail(opts: LayoutOptions): string {
  const { title, intro, bodyHtml, ctaLabel, ctaUrl, footnote } = opts;
  const button =
    ctaLabel && ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
           <tr><td style="border-radius:12px;background:#2751fb;">
             <a href="${escapeHtml(ctaUrl)}" target="_blank"
                style="display:inline-block;padding:14px 28px;font-weight:700;font-size:15px;color:#ffffff;text-decoration:none;border-radius:12px;">
               ${escapeHtml(ctaLabel)}
             </a>
           </td></tr>
         </table>`
      : '';

  return `<!doctype html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#070b18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#070b18;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:20px;overflow:hidden;">
        <tr><td style="background:#070b18;padding:22px 28px;">
          <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;color:#ffffff;">${BRAND}</span>
        </td></tr>
        <tr><td style="padding:28px 28px 8px;">
          <h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;font-weight:800;color:#0f172a;">${escapeHtml(title)}</h1>
          <p style="margin:0;font-size:15px;line-height:1.6;color:#475569;">${escapeHtml(intro)}</p>
        </td></tr>
        <tr><td style="padding:8px 28px 4px;font-size:15px;line-height:1.6;color:#334155;">
          ${bodyHtml}
          ${button}
        </td></tr>
        ${
          footnote
            ? `<tr><td style="padding:4px 28px 24px;font-size:13px;line-height:1.55;color:#94a3b8;">${footnote}</td></tr>`
            : ''
        }
        <tr><td style="padding:18px 28px;border-top:1px solid #eef2f7;font-size:12px;color:#94a3b8;">
          Este correo lo envía <strong style="color:#64748b;">${BRAND}</strong>. Si no esperabas este mensaje, puedes ignorarlo.
        </td></tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#475569;">Impulsado por ${BRAND}</p>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Envío ───────────────────────────────────────────────────
async function sendViaResend(msg: EmailMessage): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.email.resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.email.from,
      to: [msg.to],
      subject: msg.subject,
      html: msg.html,
      text: msg.text ?? htmlToText(msg.html),
      reply_to: msg.replyTo ?? env.email.replyTo,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Resend respondió ${res.status}: ${detail.slice(0, 300)}`);
  }
}

function logEmail(msg: EmailMessage): void {
  // En dev, imprime el correo para poder copiar enlaces (p. ej. el de recuperación).
  // eslint-disable-next-line no-console
  console.info(
    [
      '',
      '📧 ─── EMAIL (driver=log, no enviado) ───────────────',
      `   Para:    ${msg.to}`,
      `   Asunto:  ${msg.subject}`,
      `   Texto:   ${(msg.text ?? htmlToText(msg.html)).slice(0, 500)}`,
      '────────────────────────────────────────────────────',
      '',
    ].join('\n'),
  );
}

// Envía un correo. No lanza: devuelve true/false. Los fallos se registran.
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  try {
    if (env.email.driver === 'resend' && env.email.resendApiKey) {
      await sendViaResend(msg);
    } else {
      logEmail(msg);
    }
    return true;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[mailer] No se pudo enviar el correo:', (err as Error).message);
    return false;
  }
}

// ── Correos específicos ─────────────────────────────────────
export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
  ttlMin: number;
}): Promise<boolean> {
  const html = renderBrandedEmail({
    title: 'Recupera tu acceso',
    intro: `Hola ${params.name.split(' ')[0] || ''}, recibimos una solicitud para restablecer la contraseña de tu cuenta.`,
    bodyHtml: `<p style="margin:0 0 4px;">Haz clic en el botón para crear una nueva contraseña. Este enlace vence en <strong>${params.ttlMin} minutos</strong>.</p>`,
    ctaLabel: 'Crear nueva contraseña',
    ctaUrl: params.resetUrl,
    footnote: `Si el botón no funciona, copia y pega este enlace en tu navegador:<br><span style="color:#2751fb;word-break:break-all;">${escapeHtml(params.resetUrl)}</span><br><br>Si no solicitaste este cambio, ignora este correo: tu contraseña seguirá igual.`,
  });
  return sendEmail({ to: params.to, subject: `${BRAND} · Recupera tu acceso`, html });
}

export async function sendNewOrderEmail(params: {
  to: string;
  riferoName: string;
  buyerName: string;
  raffleTitle: string;
  eventLabel: string;
  ticketCount: number;
  totalAmount: number;
  orderCode: string;
  panelUrl: string;
}): Promise<boolean> {
  const money = `$${params.totalAmount.toLocaleString('es-MX')} MXN`;
  const bodyHtml = `
    <p style="margin:0 0 14px;">Tienes una nueva orden por confirmar en <strong>${escapeHtml(params.raffleTitle)}</strong> (${escapeHtml(params.eventLabel)}).</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border:1px solid #eef2f7;border-radius:12px;">
      <tr><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b;">Folio</td><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;">${escapeHtml(params.orderCode)}</td></tr>
      <tr><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b;">Comprador</td><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;">${escapeHtml(params.buyerName)}</td></tr>
      <tr><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#64748b;">Boletos</td><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:700;">${params.ticketCount}</td></tr>
      <tr><td style="padding:10px 14px;color:#64748b;">Total</td><td style="padding:10px 14px;text-align:right;font-weight:800;color:#0f172a;">${money}</td></tr>
    </table>`;
  const html = renderBrandedEmail({
    title: 'Nueva orden 🎟️',
    intro: `Hola ${params.riferoName.split(' ')[0] || ''}, un comprador acaba de apartar boletos.`,
    bodyHtml,
    ctaLabel: 'Revisar orden',
    ctaUrl: params.panelUrl,
    footnote: 'Confírmala o recházala desde tu panel para liberar o asegurar los boletos.',
  });
  return sendEmail({ to: params.to, subject: `${BRAND} · Nueva orden ${params.orderCode}`, html });
}
