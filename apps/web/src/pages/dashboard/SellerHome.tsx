import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, Link2, Receipt, ArrowRight, Ticket, Wallet, Clock, CheckCircle2 } from 'lucide-react';
import { formatMXN } from '@bismark/shared';
import { userService } from '@/services/users';
import { useAuthStore } from '@/store/auth';
import { buildSellerHomeUrl } from '@/lib/site';
import { copyToClipboard } from '@/lib/clipboard';
import { PANEL_CARD } from '@/components/owner/PanelKit';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/ui/misc';
import { cn } from '@/lib/cn';

function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className={cn(PANEL_CARD, 'p-3.5')}>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p className={cn('mt-1.5 text-2xl font-extrabold leading-none tracking-tight tabular-nums', accent)}>{value}</p>
    </div>
  );
}

// Panel del vendedor: bienvenida, su link de venta y métricas de SUS ventas.
export default function SellerHome() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const link = user?.sellerCode ? buildSellerHomeUrl(user.sellerCode) : null;

  const statsQuery = useQuery({ queryKey: ['seller-stats'], queryFn: () => userService.myStats() });
  const s = statsQuery.data?.stats;

  const shareLink = () => {
    if (!link) return;
    if (navigator.share) {
      void navigator.share({ title: 'Compra tus boletos', url: link }).catch(() => {});
      return;
    }
    void copyToClipboard(link, 'Link copiado');
  };

  return (
    <div className="space-y-5">
      {/* Bienvenida */}
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight">
          Hola, {user?.name?.split(' ')[0] ?? 'vendedor'} 👋
        </h1>
        <p className="text-sm text-muted-foreground">Este es tu panel de ventas. Comparte tu link y cierra ventas.</p>
      </div>

      {/* Link de venta */}
      {link && (
        <div className={cn(PANEL_CARD, 'p-4')}>
          <div className="flex items-center gap-2 text-sm font-bold">
            <Link2 className="h-4 w-4 text-primary" />
            Tu link de venta
            {user?.sellerCode && (
              <span className="ml-auto inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-bold">
                {user.sellerCode}
              </span>
            )}
          </div>
          <p className="mt-2 break-all rounded-xl border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
            {link}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Todas las compras que se hagan desde tu link se registran como tus ventas.
          </p>
          <div className="mt-3 flex gap-2">
            <Button variant="brand" className="flex-1" onClick={shareLink}>
              <Copy className="h-4 w-4" /> Compartir mi link
            </Button>
          </div>
        </div>
      )}

      {/* Métricas */}
      {statsQuery.isLoading ? (
        <PageLoader />
      ) : (
        s && (
          <div className="grid grid-cols-2 gap-3">
            <MetricCard icon={Receipt} label="Órdenes" value={s.ordersTotal.toLocaleString('es-MX')} />
            <MetricCard
              icon={Wallet}
              label="Vendido (pagado)"
              value={formatMXN(s.revenue)}
              accent="text-emerald-600 dark:text-emerald-400"
            />
            <MetricCard icon={Ticket} label="Boletos pagados" value={s.ticketsSold.toLocaleString('es-MX')} />
            <MetricCard
              icon={Clock}
              label="Pendientes"
              value={s.pendingOrders.toLocaleString('es-MX')}
              accent="text-amber-600 dark:text-amber-400"
            />
            <MetricCard
              icon={CheckCircle2}
              label="Pagadas"
              value={s.paidOrders.toLocaleString('es-MX')}
              accent="text-blue-600 dark:text-blue-400"
            />
            <MetricCard icon={Receipt} label="Canceladas" value={s.cancelledOrders.toLocaleString('es-MX')} />
          </div>
        )
      )}

      {/* Acceso a sus ventas */}
      <Button variant="outline" size="lg" className="w-full" onClick={() => navigate('/admin/ordenes')}>
        Ver mis ventas <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
