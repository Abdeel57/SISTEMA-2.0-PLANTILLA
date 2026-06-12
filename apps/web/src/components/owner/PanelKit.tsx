import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

// Kit visual del panel del rifero: refinado y sobrio (azul Bismark).
// Da una capa de pulido consistente (tarjetas con sombra suave/elevada,
// encabezados claros, métricas y secciones) sin sobrecargar de color.

// Sombra premium pero discreta para tarjetas del panel.
export const PANEL_CARD =
  'rounded-2xl border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_28px_-18px_rgba(16,24,40,0.22)]';

// Encabezado de sección del panel: ícono opcional, título, descripción y acción.
export function PanelHeader({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
            <Icon className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-extrabold tracking-tight">{title}</h1>
          {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// Intro de sección SIN título: el header del panel ya muestra el nombre de la
// pantalla; repetirlo aquí hacía sentir todo duplicado y pesado en móvil.
// Solo descripción breve (opcional) y/o la acción de la pantalla.
export function PanelIntro({
  description,
  action,
  className,
}: {
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  if (!description && !action) return null;
  return (
    <div className={cn('mb-4 flex items-center justify-between gap-3', className)}>
      {description ? (
        <p className="min-w-0 text-sm text-muted-foreground">{description}</p>
      ) : (
        <span />
      )}
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// Etiqueta de grupo/sección (encima de listas o grupos de tarjetas).
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn('mb-3 mt-7 text-xs font-bold uppercase tracking-wider text-muted-foreground', className)}>
      {children}
    </h2>
  );
}

// Tarjeta de métrica refinada. `accent` resalta la métrica más importante.
export function StatTile({
  icon: Icon,
  label,
  value,
  to,
  accent = false,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  to?: string;
  accent?: boolean;
}) {
  const inner = (
    <div
      className={cn(
        PANEL_CARD,
        'flex h-full items-center gap-3.5 p-4 transition-all',
        to && 'hover:-translate-y-0.5 active:translate-y-0',
        accent && 'border-primary/30 ring-1 ring-primary/10',
      )}
    >
      <span
        className={cn(
          'grid h-11 w-11 shrink-0 place-items-center rounded-xl',
          accent
            ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30'
            : 'bg-primary/10 text-primary ring-1 ring-primary/15',
        )}
      >
        <Icon className="h-[22px] w-[22px]" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-extrabold leading-none tracking-tight">{value}</p>
        <p className="mt-1 truncate text-xs font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
  return to ? (
    <Link to={to} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

// Tarjeta de sección con cabecera (para formularios y bloques de contenido).
export function SectionCard({
  title,
  description,
  icon: Icon,
  action,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn(PANEL_CARD, 'overflow-hidden', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {Icon && (
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0">
              {title && <h3 className="truncate text-sm font-bold tracking-tight">{title}</h3>}
              {description && <p className="truncate text-xs text-muted-foreground">{description}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn('p-4', bodyClassName)}>{children}</div>
    </div>
  );
}

// Barra de progreso de venta, refinada (con degradado azul sutil).
export function ProgressBar({ value }: { value: number }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
