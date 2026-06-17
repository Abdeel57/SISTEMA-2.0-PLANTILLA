import { cn } from '@/lib/cn';

// Tira de promoción/aviso de la rifa: rectangular y a todo lo ancho, pegada
// bajo el cintillo de la rifa (sin bordes blancos). El rifero la configura por
// rifa en "Promociones" del panel: título, aviso y colores del degradado.
// Con `sticky` se queda fija bajo el cintillo al hacer scroll (se apaga cuando
// el panel de apartado necesita ese espacio). Un destello blanco "pulido" la
// barre periódicamente (promo-shine).
const DEFAULT_FROM = '#f97316'; // naranja
const DEFAULT_TO = '#dc2626'; // rojo

export function PromoBanner({
  title,
  subtitle,
  colorFrom,
  colorTo,
  sticky = false,
  topPx = 0,
}: {
  title: string;
  subtitle?: string | null;
  colorFrom?: string | null;
  colorTo?: string | null;
  sticky?: boolean;
  topPx?: number;
}) {
  return (
    <div
      className={cn('relative w-full overflow-hidden text-center text-white shadow-md', sticky && 'sticky z-30')}
      style={{
        background: `linear-gradient(100deg, ${colorFrom || DEFAULT_FROM}, ${colorTo || DEFAULT_TO})`,
        ...(sticky ? { top: topPx } : {}),
      }}
    >
      <p className="px-4 py-1.5 font-display text-sm font-extrabold uppercase tracking-wide [text-shadow:0_1px_2px_rgba(0,0,0,0.3)] sm:text-base">
        {title}
      </p>
      {subtitle && <p className="bg-black/25 px-4 py-1 text-[11px] font-semibold text-white/95 sm:text-xs">{subtitle}</p>}
      {/* Destello diagonal que barre la tira (mismo lenguaje que el BrandLoader). */}
      <span aria-hidden className="promo-shine pointer-events-none absolute inset-0" />
    </div>
  );
}
