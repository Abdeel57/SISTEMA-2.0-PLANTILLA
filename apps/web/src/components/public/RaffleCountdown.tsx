import { useEffect, useState } from 'react';
import { formatDateTimeMX, RaffleStatus } from '@bismark/shared';

// Cuenta regresiva al sorteo. Si la rifa sigue activa y la fecha es futura,
// muestra un cronómetro (días/horas/min/seg) que corre en vivo. Si ya finalizó
// o no hay cuenta regresiva, sólo muestra la fecha del sorteo.
// Sin fondo propio (transparente): vive dentro del hero y hereda su fondo,
// para que la sombra del marco de la imagen fluya hacia abajo sin cortarse.

function breakdown(target: Date, now: number) {
  const ms = Math.max(0, target.getTime() - now);
  return {
    d: Math.floor(ms / 86_400_000),
    h: Math.floor((ms % 86_400_000) / 3_600_000),
    m: Math.floor((ms % 3_600_000) / 60_000),
    s: Math.floor((ms % 60_000) / 1_000),
  };
}

const pad = (n: number) => String(n).padStart(2, '0');

// Una unidad del contador: tarjeta con franja de acento (color del rifero),
// número grande monoespaciado y etiqueta. `pulse` resalta los segundos.
function Segment({ value, label, pulse = false }: { value: number; label: string; pulse?: boolean }) {
  return (
    <div className="relative flex min-w-[54px] flex-col items-center overflow-hidden rounded-2xl border border-foreground/[0.07] bg-gradient-to-b from-muted/20 to-muted/70 px-2.5 py-2.5 shadow-[0_6px_18px_-10px_rgba(0,0,0,0.35)] backdrop-blur-sm sm:min-w-[78px] sm:py-3">
      <span className="absolute inset-x-0 top-0 h-[3px] bg-[var(--rifero-primary)]" />
      <span
        className={`font-mono text-[1.75rem] font-black leading-none tabular-nums text-foreground sm:text-[2.4rem] ${
          pulse ? 'text-[var(--rifero-primary)]' : ''
        }`}
      >
        {pad(value)}
      </span>
      <span className="mt-2 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground sm:text-[10px]">
        {label}
      </span>
    </div>
  );
}

// Separador ":" alineado con los números (ignora la altura de las etiquetas).
function Colon() {
  return (
    <span className="-mt-3 self-center font-mono text-2xl font-black leading-none text-foreground/25 sm:text-3xl">
      :
    </span>
  );
}

interface Props {
  drawDate: string | null;
  status: RaffleStatus;
}

export function RaffleCountdown({ drawDate, status }: Props) {
  const [now, setNow] = useState(() => Date.now());
  const target = drawDate ? new Date(drawDate) : null;
  const finished = status === RaffleStatus.FINISHED || status === RaffleStatus.CANCELLED;
  const live = !!target && !finished && target.getTime() > now;

  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [live]);

  // Sin fecha y sin finalizar: nada que mostrar.
  if (!target && !finished) return null;

  if (live && target) {
    const { d, h, m, s } = breakdown(target, now);
    return (
      <section className="px-4 pb-6 pt-6 text-foreground">
        <div className="mx-auto max-w-2xl text-center">
          {/* Encabezado con punto "en vivo" */}
          <div className="mb-4 flex items-center justify-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--rifero-primary)] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--rifero-primary)]" />
            </span>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--rifero-primary)]">
              Faltan para el sorteo
            </p>
          </div>

          <div className="flex items-stretch justify-center gap-1 sm:gap-2">
            <Segment value={d} label={d === 1 ? 'Día' : 'Días'} />
            <Colon />
            <Segment value={h} label="Horas" />
            <Colon />
            <Segment value={m} label="Min" />
            <Colon />
            <Segment value={s} label="Seg" pulse />
          </div>
        </div>
      </section>
    );
  }

  // Finalizado, cancelado o fecha ya pasada: sólo la fecha del sorteo.
  return (
    <section className="bg-background px-4 pb-6 pt-2 text-foreground">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
          {finished ? 'Sorteo realizado' : 'Fecha del sorteo'}
        </p>
        {drawDate && (
          <p className="mt-2 text-lg font-black uppercase tracking-wide text-foreground sm:text-xl">
            {formatDateTimeMX(drawDate)}
          </p>
        )}
      </div>
    </section>
  );
}
