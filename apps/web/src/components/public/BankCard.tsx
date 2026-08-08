import { Copy, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import type { PaymentMethodDTO } from '@bismark/shared';
import { detectBank } from '@/lib/banks';
import { t, useT, useLocale } from '@/store/site';

// Tarjeta bancaria realista para un método de pago: degradado del banco,
// chip, número en relieve y copiar-al-toque. Se tematiza sola con detectBank().

function copyText(text: string, label: string) {
  navigator.clipboard
    .writeText(text)
    .then(() => toast.success(t('common.copied', { label })))
    .catch(() => toast.error(t('common.copyFailed')));
}

// Agrupa el número de tarjeta de 4 en 4 (tolera espacios ya escritos).
const groupCard = (v: string) => v.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim();

// Chip dorado (SVG)
function Chip() {
  return (
    <svg viewBox="0 0 44 32" className="h-7 w-10" aria-hidden>
      <rect x="1" y="1" width="42" height="30" rx="6" fill="url(#chipGrad)" stroke="rgba(0,0,0,0.25)" />
      <path
        d="M1 12h13M1 20h13M30 12h13M30 20h13M14 1v30M30 1v30M14 12c5 0 5 8 0 8M30 12c-5 0-5 8 0 8"
        stroke="rgba(0,0,0,0.3)"
        strokeWidth="1.2"
        fill="none"
      />
      <defs>
        <linearGradient id="chipGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f3d27a" />
          <stop offset="0.5" stopColor="#d9ab44" />
          <stop offset="1" stopColor="#f0cb6e" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function CopyPill({ value, label, fg }: { value: string; label: string; fg: string }) {
  const tr = useT();
  return (
    <button
      type="button"
      onClick={() => copyText(value, label)}
      aria-label={`${tr('common.copy')} ${label}`}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-transform active:scale-90"
      style={{ background: 'rgba(255,255,255,0.16)', color: fg, backdropFilter: 'blur(4px)' }}
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

export function BankCard({ method }: { method: PaymentMethodDTO }) {
  const tr = useT();
  const locale = useLocale();
  const theme = detectBank(method.bank);
  const fg = theme.fg;
  const soft = theme.fgSoft;
  const emboss = { textShadow: '0 1px 0 rgba(0,0,0,0.35), 0 -1px 0 rgba(255,255,255,0.15)' };

  return (
    <div>
      <div
        className="relative flex flex-col overflow-hidden rounded-2xl p-4 shadow-[0_16px_40px_-14px_rgba(0,0,0,0.45)] sm:p-5"
        style={{ background: theme.bg, color: fg, minHeight: 200 }}
      >
        {/* Texturas: grano + brillo diagonal */}
        <div className="grain pointer-events-none absolute inset-0 opacity-[0.14]" />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: 'linear-gradient(115deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.05) 28%, transparent 46%)' }}
        />
        <div
          className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full"
          style={{ background: 'rgba(255,255,255,0.08)', filter: 'blur(30px)' }}
        />

        <div className="relative flex flex-1 flex-col justify-between gap-3">
          {/* Marca + contactless */}
          <div className="flex items-start justify-between gap-3">
            <div style={{ color: fg }}>{theme.logo}</div>
            <Wifi className="h-5 w-5 rotate-90 opacity-70" />
          </div>

          {/* Chip + número (o usuario, en monederos de EE. UU.) */}
          <div className="mt-1">
            <Chip />
            {method.handle ? (
              <div className="mt-2">
                <p className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: soft }}>
                  {theme.handleLabel ? theme.handleLabel[locale] : tr('pay.holder')}
                </p>
                <div className="mt-0.5 flex items-center gap-2">
                  <p className="min-w-0 break-all font-ticket text-lg font-bold tracking-[0.06em] sm:text-xl" style={emboss}>
                    {method.handle}
                  </p>
                  <CopyPill
                    value={method.handle}
                    label={theme.handleLabel ? theme.handleLabel[locale] : tr('pay.holder')}
                    fg={fg}
                  />
                </div>
              </div>
            ) : method.cardNumber ? (
              <div className="mt-2 flex items-center gap-2">
                <p className="min-w-0 break-all font-ticket text-lg font-bold tracking-[0.12em] sm:text-xl" style={emboss}>
                  {groupCard(method.cardNumber)}
                </p>
                <CopyPill value={method.cardNumber.replace(/\s+/g, '')} label={tr('pay.card')} fg={fg} />
              </div>
            ) : method.clabe ? (
              <div className="mt-2 flex items-center gap-2">
                <p className="font-ticket text-base font-bold tracking-[0.08em] sm:text-lg" style={emboss}>
                  {method.clabe}
                </p>
                <CopyPill value={method.clabe} label={tr('pay.clabe')} fg={fg} />
              </div>
            ) : null}
            {method.cardNumber && method.clabe && (
              <div className="mt-1.5 flex items-center gap-2">
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: soft }}>
                  {tr('pay.clabe')}
                </p>
                <p className="font-ticket text-xs font-bold tracking-[0.06em]">{method.clabe}</p>
                <CopyPill value={method.clabe} label={tr('pay.clabe')} fg={fg} />
              </div>
            )}
          </div>

          {/* Titular + concepto */}
          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[9px] font-bold uppercase tracking-[0.18em]" style={{ color: soft }}>
                {tr('pay.holder')}
              </p>
              <p className="truncate font-ticket text-sm font-bold uppercase tracking-wide" style={emboss}>
                {method.holderName || '—'}
              </p>
            </div>
            {method.concept && (
              <button
                type="button"
                onClick={() => copyText(method.concept as string, tr('pay.concept'))}
                className="max-w-[45%] truncate rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-transform active:scale-95"
                style={{ background: 'rgba(255,255,255,0.16)', color: fg }}
                title={`${tr('pay.concept')}: ${method.concept}`}
              >
                {method.concept}
              </button>
            )}
          </div>
        </div>
      </div>

      {method.instructions && (
        <p className="mt-2 whitespace-pre-line px-1 text-xs leading-relaxed text-muted-foreground">
          {method.instructions}
        </p>
      )}
    </div>
  );
}
