import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { ScanLine, Search, X, Store, Gift } from 'lucide-react';
import {
  formatMXN,
  formatDateTimeMX,
  timeRemaining,
  waReserveMessage,
  dialCodeForCountry,
  type OrderDTO,
} from '@bismark/shared';
import { orderService, type OrderFilter } from '@/services/orders';
import { ApiError, apiAssetUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useAuthStore } from '@/store/auth';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageLoader, EmptyState } from '@/components/ui/misc';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { OrderStatusBadge } from '@/lib/statusBadges';
import { WhatsAppButton } from '@/components/brand/WhatsAppButton';
import { QrScanner } from '@/components/owner/QrScanner';
import { PanelIntro, PANEL_CARD } from '@/components/owner/PanelKit';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';

type UrlFilter = 'pendientes' | 'pagadas' | 'todas';

const URL_TO_API: Record<UrlFilter, OrderFilter> = {
  pendientes: 'pending',
  pagadas: 'paid',
  todas: 'all',
};

const TABS: { value: UrlFilter; label: string }[] = [
  { value: 'pendientes', label: 'Pendientes' },
  { value: 'pagadas', label: 'Pagadas' },
  { value: 'todas', label: 'Todas' },
];

const PAGE_SIZE = 15;
const MAX_CHIPS = 10;

function ProofDialog({ orderId, className }: { orderId: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const proofsQuery = useQuery({
    queryKey: ['order-proofs', orderId],
    queryFn: () => orderService.proofs(orderId),
    enabled: open,
  });
  const proofs = proofsQuery.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" className={className} onClick={() => setOpen(true)}>
        Comprobante
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Comprobante de pago</DialogTitle>
          <DialogDescription>Revisa el comprobante que envió el comprador.</DialogDescription>
        </DialogHeader>
        {proofsQuery.isLoading ? (
          <PageLoader />
        ) : proofs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No hay comprobantes para mostrar.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {proofs.map((proof) => (
              <a
                key={proof.id}
                href={apiAssetUrl(proof.fileUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-xl border"
              >
                <img
                  src={apiAssetUrl(proof.fileUrl)}
                  alt="Comprobante de pago"
                  loading="lazy"
                  decoding="async"
                  className="w-full object-contain"
                />
                {proof.note && <p className="p-3 text-sm text-muted-foreground">{proof.note}</p>}
              </a>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// Números de boleto con límite: una orden de 200 boletos no debe hacer la
// tarjeta interminable. Se muestran los primeros y un "+N más" expandible.
function TicketChips({ numbers }: { numbers: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (numbers.length === 0) return null;
  const visible = expanded ? numbers : numbers.slice(0, MAX_CHIPS);
  const hidden = numbers.length - visible.length;
  return (
    <div className="flex flex-wrap gap-1.5">
      {visible.map((n) => (
        <span key={n} className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold">
          {n}
        </span>
      ))}
      {(hidden > 0 || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="rounded-md bg-brand/10 px-2 py-0.5 font-mono text-xs font-bold text-brand transition-colors hover:bg-brand/20"
        >
          {expanded ? 'ver menos' : `+${hidden} más`}
        </button>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: OrderDTO }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<'reject' | 'cancel' | null>(null);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
  };

  const onError = (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Algo salió mal');

  // Cambia el estado de la orden en caché al instante (optimista) y revierte
  // si el servidor falla: en redes lentas el panel se siente inmediato.
  const optimisticStatus = (status: OrderDTO['status']) => ({
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      const previous = queryClient.getQueriesData<{ items: OrderDTO[] }>({ queryKey: ['orders'] });
      queryClient.setQueriesData<{ items: OrderDTO[] } | undefined>({ queryKey: ['orders'] }, (data) =>
        data
          ? { items: data.items.map((o) => (o.id === order.id ? { ...o, status } : o)) }
          : data,
      );
      return { previous };
    },
    onError: (e: unknown, _vars: void, ctx?: { previous: [QueryKey, { items: OrderDTO[] } | undefined][] }) => {
      ctx?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      onError(e);
    },
    onSettled: invalidate,
  });

  const markPaid = useMutation({
    mutationFn: () => orderService.markPaid(order.id),
    ...optimisticStatus('PAID'),
    onSuccess: () => toast.success('Orden marcada como pagada'),
  });

  const reject = useMutation({
    mutationFn: () => orderService.reject(order.id),
    ...optimisticStatus('REJECTED'),
    onSuccess: () => {
      setConfirming(null);
      toast.success('Orden rechazada');
    },
  });

  const cancel = useMutation({
    mutationFn: () => orderService.cancel(order.id),
    ...optimisticStatus('CANCELLED'),
    onSuccess: () => {
      setConfirming(null);
      toast.success('Orden cancelada');
    },
  });

  // Acciones de cobro: aplican a apartadas (RESERVED) y a las que ya subieron
  // comprobante (PENDING). Antes sólo PENDING → no se podía confirmar un apartado.
  const isPending = order.status === 'PENDING' || order.status === 'RESERVED';
  const remaining = timeRemaining(order.expiresAt);
  const waPhone = order.buyer.whatsapp ?? order.buyer.phone;
  // Lada del comprador (+52 México / +1 USA) para que el WhatsApp abra correcto.
  const buyerDial = dialCodeForCountry(order.buyer.country);
  const waMessage = waReserveMessage({
    raffleName: `${order.raffleTitle} (${order.eventLabel})`,
    ticketNumbers: order.ticketNumbers.join(', '),
    total: formatMXN(order.totalAmount),
    orderCode: order.code,
  });

  return (
    <div className={cn(PANEL_CARD, 'flex flex-col gap-3 p-4')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-muted-foreground">{order.code}</p>
          <p className="truncate text-base font-bold leading-tight">{order.buyer.fullName}</p>
          <p className="text-sm text-muted-foreground tabular-nums">
            +{buyerDial} {order.buyer.phone}
            {order.buyer.country === 'US' && <span className="ml-1 font-semibold">🇺🇸 USA</span>}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      <div className="text-sm">
        <span className="font-semibold">{order.raffleTitle}</span>{' '}
        <span className="text-muted-foreground">· {order.eventLabel}</span>
      </div>

      {/* Vendedor atribuido (o venta directa) */}
      <div className="flex items-center gap-1.5 text-xs">
        <Store className="h-3.5 w-3.5 text-muted-foreground" />
        {order.seller ? (
          <span className="font-semibold">
            {order.seller.name}
            {order.seller.sellerCode && (
              <span className="ml-1 font-mono font-bold text-muted-foreground">({order.seller.sellerCode})</span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground">Venta directa</span>
        )}
      </div>

      {order.giftNumbers.length > 0 ? (
        <div className="space-y-2">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">Elegidos</p>
            <TicketChips numbers={order.ticketNumbers} />
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-primary">
              <Gift className="h-3.5 w-3.5" /> Regalo ({order.giftNumbers.length})
            </p>
            <TicketChips numbers={order.giftNumbers} />
          </div>
          <p className="text-xs font-semibold text-muted-foreground">
            Números participantes: {order.ticketNumbers.length + order.giftNumbers.length}
            <span className="ml-1 font-normal">· {order.opportunities} oportunidades por boleto</span>
          </p>
        </div>
      ) : (
        <TicketChips numbers={order.ticketNumbers} />
      )}

      <div className="flex items-center justify-between gap-2 border-t pt-3">
        <p className="text-xl font-extrabold tracking-tight">{formatMXN(order.totalAmount)}</p>
        <p className="text-right text-xs text-muted-foreground">{formatDateTimeMX(order.createdAt)}</p>
      </div>

      {isPending && remaining && (
        <p className="text-xs font-semibold text-amber-600 dark:text-amber-400">Vence en {remaining}</p>
      )}

      {/* Acción principal a la vista; lo demás en fila secundaria. */}
      {isPending && (
        <div className="flex gap-2">
          {order.hasProof && <ProofDialog orderId={order.id} className="h-11 flex-1" />}
          <Button
            variant="success"
            className="h-11 flex-[1.4]"
            loading={markPaid.isPending}
            onClick={() => markPaid.mutate()}
          >
            Marcar pagado
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <WhatsAppButton phone={waPhone} dialCode={buyerDial} message={waMessage} size="sm" />
        {order.digitalTicketCode && (
          <Button asChild variant="outline" size="sm">
            <a
              href={apiAssetUrl(`/tickets/digital/${order.digitalTicketCode}/pdf`)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Boleto digital
            </a>
          </Button>
        )}
        {!isPending && order.hasProof && <ProofDialog orderId={order.id} />}
        {isPending && (
          <div className="ml-auto flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirming('reject')}
            >
              Rechazar
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              onClick={() => setConfirming('cancel')}
            >
              Cancelar
            </Button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirming === 'reject'}
        onOpenChange={(o) => !o && setConfirming(null)}
        title="¿Rechazar este pago?"
        description={
          <>
            La orden <span className="font-mono font-semibold">{order.code}</span> de{' '}
            <span className="font-semibold">{order.buyer.fullName}</span> se marcará como rechazada y
            sus boletos volverán a estar disponibles. Esta acción no se puede deshacer.
          </>
        }
        confirmLabel="Sí, rechazar"
        destructive
        loading={reject.isPending}
        onConfirm={() => reject.mutate()}
      />
      <ConfirmDialog
        open={confirming === 'cancel'}
        onOpenChange={(o) => !o && setConfirming(null)}
        title="¿Cancelar este apartado?"
        description={
          <>
            La orden <span className="font-mono font-semibold">{order.code}</span> de{' '}
            <span className="font-semibold">{order.buyer.fullName}</span> se cancelará y sus boletos
            volverán a estar disponibles. Esta acción no se puede deshacer.
          </>
        }
        confirmLabel="Sí, cancelar apartado"
        destructive
        loading={cancel.isPending}
        onConfirm={() => cancel.mutate()}
      />
    </div>
  );
}

export default function Orders() {
  const params = useParams<{ filter?: string }>();
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.user?.role);
  const isSeller = role === 'SELLER';
  const [scanOpen, setScanOpen] = useState(false);
  const [search, setSearch] = useState('');
  // Filtro por vendedor (solo admin): 'all' | 'direct' | <sellerId>.
  const [sellerFilter, setSellerFilter] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const urlFilter: UrlFilter =
    params.filter && params.filter in URL_TO_API ? (params.filter as UrlFilter) : 'pendientes';
  const apiFilter = URL_TO_API[urlFilter];

  const ordersQuery = useQuery({
    queryKey: ['orders', apiFilter],
    queryFn: () => orderService.list(apiFilter),
  });

  const orders = ordersQuery.data?.items ?? [];

  // Vendedores presentes en las órdenes cargadas (para el desplegable de filtro).
  const sellerOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const o of orders) {
      if (o.seller) map.set(o.seller.id, o.seller.sellerCode ? `${o.seller.name} (${o.seller.sellerCode})` : o.seller.name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [orders]);

  // Búsqueda local (código, nombre, teléfono, rifa) + filtro por vendedor.
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (sellerFilter === 'direct' && o.seller) return false;
      if (sellerFilter !== 'all' && sellerFilter !== 'direct' && o.seller?.id !== sellerFilter) return false;
      if (!q) return true;
      return (
        o.code.toLowerCase().includes(q) ||
        o.buyer.fullName.toLowerCase().includes(q) ||
        o.buyer.phone.toLowerCase().includes(q) ||
        o.raffleTitle.toLowerCase().includes(q)
      );
    });
  }, [orders, search, sellerFilter]);

  // Render incremental: con cientos de órdenes el DOM no se desploma.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [urlFilter, search, sellerFilter]);
  const visible = filtered.slice(0, visibleCount);

  return (
    <div>
      <PanelIntro
        description={
          isSeller ? 'Estas son las ventas generadas con tu link.' : 'Administra los apartados y pagos de tus rifas.'
        }
        action={
          <Button variant="outline" size="sm" onClick={() => setScanOpen(true)}>
            <ScanLine className="h-4 w-4" /> Validar
          </Button>
        }
      />
      <QrScanner open={scanOpen} onOpenChange={setScanOpen} />

      <Tabs value={urlFilter} onValueChange={(v) => navigate(`/admin/ordenes/${v}`)}>
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Búsqueda */}
      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nombre, teléfono, código o rifa"
          className="pl-10 pr-10"
          autoComplete="off"
        />
        {search && (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={() => setSearch('')}
            className="absolute right-1 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filtro por vendedor (solo administradores). */}
      {!isSeller && sellerOptions.length > 0 && (
        <div className="mt-3">
          <Select value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)} aria-label="Filtrar por vendedor">
            <option value="all">Todos los vendedores</option>
            <option value="direct">Venta directa (sin vendedor)</option>
            {sellerOptions.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      )}

      <div className="mt-4">
        {ordersQuery.isLoading ? (
          <PageLoader />
        ) : filtered.length === 0 ? (
          search ? (
            <EmptyState
              title="Sin resultados"
              description={`Ninguna orden coincide con "${search}". Prueba con el código, nombre o teléfono.`}
            />
          ) : (
            <EmptyState
              title="Sin órdenes por aquí"
              description="Cuando alguien aparte boletos, sus órdenes aparecerán en esta lista."
            />
          )
        ) : (
          <>
            <div className="grid grid-cols-1 items-start gap-3 xl:grid-cols-2">
              {visible.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
            {filtered.length > visibleCount && (
              <Button
                variant="outline"
                size="lg"
                className="mt-4 w-full"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                Cargar más ({filtered.length - visibleCount} restantes)
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
