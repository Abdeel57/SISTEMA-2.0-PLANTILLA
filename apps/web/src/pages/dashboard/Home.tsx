import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Receipt,
  CheckCircle2,
  Ticket,
  Wallet,
  Megaphone,
  CalendarClock,
  Plus,
  ExternalLink,
  FileBarChart,
  ChevronRight,
  Sparkles,
  Check,
  type LucideIcon,
} from 'lucide-react';
import { formatMXN } from '@bismark/shared';
import { raffleService } from '@/services/raffles';
import { riferoService } from '@/services/riferos';
import { useAuthStore } from '@/store/auth';
import { buildRiferoShareUrl } from '@/lib/site';
import { PageLoader } from '@/components/ui/misc';
import { PanelHeader, StatTile, SectionLabel, PANEL_CARD } from '@/components/owner/PanelKit';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';

const QUICK_ACTIONS: { to: string; label: string; icon: LucideIcon; accent?: boolean }[] = [
  { to: '/admin/rifas/nueva', label: 'Nueva rifa', icon: Plus, accent: true },
  { to: '/admin/ordenes', label: 'Órdenes', icon: Receipt },
  { to: '/', label: 'Ver mi página', icon: ExternalLink },
  { to: '/admin/reportes', label: 'Reportes', icon: FileBarChart },
];

const SHARED_KEY = 'bsk-shared-page';

// ── Checklist de primeros pasos ──────────────────────────────
// Guía al rifero nuevo: pagos → crear → publicar → compartir. Se oculta sola
// cuando los 4 pasos están completos.
function StepRow({
  n,
  title,
  desc,
  done,
  to,
  onClick,
}: {
  n: number;
  title: string;
  desc: string;
  done: boolean;
  to?: string;
  onClick?: () => void;
}) {
  const body = (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-colors',
        done ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30' : 'bg-card hover:border-primary/40',
      )}
    >
      <span
        className={cn(
          'grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-extrabold',
          done ? 'bg-emerald-500 text-white' : 'bg-primary/10 text-primary',
        )}
      >
        {done ? <Check className="h-4 w-4" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('text-sm font-bold leading-tight', done && 'text-emerald-700 line-through decoration-emerald-400 dark:text-emerald-400')}>
          {title}
        </p>
        {!done && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      {!done && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
    </div>
  );
  if (done) return body;
  if (to) return <Link to={to}>{body}</Link>;
  return (
    <button type="button" onClick={onClick} className="block w-full text-left">
      {body}
    </button>
  );
}

export default function Home() {
  const user = useAuthStore((s) => s.user);
  const firstName = user?.name?.split(' ')[0] ?? 'rifero';
  const [shared, setShared] = useState(() => !!localStorage.getItem(SHARED_KEY));

  const summaryQuery = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: raffleService.dashboardSummary,
  });

  const profileQuery = useQuery({
    queryKey: ['rifero-me'],
    queryFn: riferoService.me,
  });

  const rafflesQuery = useQuery({
    queryKey: ['raffles'],
    queryFn: () => raffleService.list(),
  });

  const summary = summaryQuery.data?.summary;
  const profile = profileQuery.data?.profile;
  const raffles = rafflesQuery.data?.items ?? [];

  // Estado de los primeros pasos
  const hasPayment = (profile?.paymentMethods?.length ?? 0) > 0;
  const hasRaffle = raffles.length > 0;
  const hasPublished = raffles.some((r) => r.status === 'PUBLISHED' || r.status === 'FINISHED');
  const allDone = hasPayment && hasRaffle && hasPublished && shared;
  const setupLoaded = !profileQuery.isLoading && !rafflesQuery.isLoading;

  const sharePage = () => {
    if (!profile) return;
    const url = buildRiferoShareUrl(profile.slug);
    const finish = () => {
      localStorage.setItem(SHARED_KEY, '1');
      setShared(true);
    };
    if (navigator.share) {
      navigator
        .share({ title: profile.publicName, text: `Participa en mis rifas: ${url}`, url })
        .then(finish)
        .catch(() => {});
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => {
        toast.success('Link copiado. ¡Pégalo en tus redes o WhatsApp!');
        finish();
      })
      .catch(() => toast.error('No se pudo copiar el link'));
  };

  return (
    <div>
      <PanelHeader title={`Hola, ${firstName}`} description="Este es el resumen de tus rifas." />

      {/* ── Primeros pasos (desaparece al completarse) ── */}
      {setupLoaded && !allDone && (
        <div className={cn(PANEL_CARD, 'mb-5 p-4')}>
          <div className="mb-3 flex items-center justify-between">
            <p className="font-display text-sm font-extrabold uppercase tracking-wide">Primeros pasos</p>
            <span className="font-ticket text-xs font-bold text-muted-foreground">
              {[hasPayment, hasRaffle, hasPublished, shared].filter(Boolean).length}/4
            </span>
          </div>
          <div className="space-y-2">
            <StepRow
              n={1}
              title="Configura tus datos de pago"
              desc="A qué cuenta te pagan tus compradores."
              done={hasPayment}
              to="/admin/pagos"
            />
            <StepRow
              n={2}
              title="Crea tu primera rifa"
              desc="Premio, boletos, precio y fecha del sorteo."
              done={hasRaffle}
              to="/admin/rifas/nueva"
            />
            <StepRow
              n={3}
              title="Publícala"
              desc="Hazla visible para tus compradores."
              done={hasPublished}
              to="/admin/rifas"
            />
            <StepRow
              n={4}
              title="Comparte tu link"
              desc="Mándalo por WhatsApp o súbelo a tus redes."
              done={shared}
              onClick={sharePage}
            />
          </div>
        </div>
      )}

      {summaryQuery.isLoading ? (
        <PageLoader />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            <StatTile
              icon={Receipt}
              label="Por cobrar"
              value={summary?.pendingOrders ?? 0}
              to="/admin/ordenes/pendientes"
              accent
            />
            <StatTile icon={CheckCircle2} label="Pagadas" value={summary?.paidOrders ?? 0} />
            <StatTile icon={Ticket} label="Vendidos" value={summary?.soldTickets ?? 0} />
            <StatTile icon={Wallet} label="Ingresos" value={formatMXN(summary?.estimatedRevenue ?? 0)} />
            <StatTile icon={Megaphone} label="Rifas activas" value={summary?.activeRaffles ?? 0} />
            <StatTile icon={CalendarClock} label="Sorteos" value={summary?.upcomingDraws ?? 0} />
          </div>

          <SectionLabel>Accesos rápidos</SectionLabel>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.to}
                  to={action.to}
                  className={cn(
                    'flex items-center gap-3 p-4 transition-all hover:-translate-y-0.5 active:translate-y-0',
                    action.accent
                      ? 'rounded-2xl border border-primary bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                      : PANEL_CARD,
                  )}
                >
                  <span
                    className={cn(
                      'grid h-9 w-9 shrink-0 place-items-center rounded-xl',
                      action.accent ? 'bg-white/20' : 'bg-primary/10 text-primary',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="truncate text-sm font-bold">{action.label}</span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
