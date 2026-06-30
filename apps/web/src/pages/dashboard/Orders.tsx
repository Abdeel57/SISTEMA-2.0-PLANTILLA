import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { ScanLine, Search, X, Store, Gift, Pencil, MapPin } from 'lucide-react';
import {
  formatMXN,
  formatDateTimeMX,
  timeRemaining,
  waReserveMessage,
  waTicketReadyMessage,
  buildWhatsappLink,
  dialCodeForCountry,
  ORDER_PAYMENT_METHODS,
  type OrderPaymentMethod,
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

// Etiqueta legible del método de pago capturado al confirmar.
const PAYMENT_METHOD_LABEL: Record<OrderPaymentMethod, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  deposito: 'Depósito',
  tarjeta: 'Tarjeta',
  otro: 'Otro',
};

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

// Edición de los DATOS del comprador (nombre/teléfono/WhatsApp/estado) cuando el
// cliente se equivocó al capturarlos. No toca boletos ni el estado de la orden.
function EditBuyerDialog({ order }: { order: OrderDTO }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState(order.buyer.fullName);
  const [phone, setPhone] = useState(order.buyer.phone);
  const [whatsapp, setWhatsapp] = useState(order.buyer.whatsapp ?? '');
  const [country, setCountry] = useState(order.buyer.country || 'MX');
  const [state, setState] = useState(order.buyer.state ?? '');

  // Al abrir, parte siempre de los datos actuales de la orden.
  useEffect(() => {
    if (!open) return;
    setFullName(order.buyer.fullName);
    setPhone(order.buyer.phone);
    setWhatsapp(order.buyer.whatsapp ?? '');
    setCountry(order.buyer.country || 'MX');
    setState(order.buyer.state ?? '');
  }, [open, order]);

  const save = useMutation({
    mutationFn: () =>
      orderService.updateBuyer(order.id, {
        fullName: fullName.trim(),
        phone: phone.trim(),
        country,
        whatsapp: whatsapp.trim(),
        state: state.trim(),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Datos del cliente actualizados');
      setOpen(false);
    },
    onError: (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'No se pudieron guardar los datos'),
  });

  const canSave = fullName.trim().length >= 2 && phone.trim().length >= 10;

  return (
    <>
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setOpen(true)}>
        <Pencil className="h-4 w-4" /> Editar datos
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar datos del cliente</DialogTitle>
            <DialogDescription>
              Corrige el nombre o el contacto si el cliente se equivocó. No cambia los boletos ni el monto.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (canSave && !save.isPending) save.mutate();
            }}
            className="space-y-3"
          >
            <div>
              <label className="mb-1 block text-sm font-semibold">Nombre completo</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="off" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-sm font-semibold">País</label>
                <Select value={country} onChange={(e) => setCountry(e.target.value)}>
                  <option value="MX">🇲🇽 MX</option>
                  <option value="US">🇺🇸 US</option>
                </Select>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-sm font-semibold">Teléfono</label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" autoComplete="off" />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">WhatsApp (opcional)</label>
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Si lo dejas vacío, se usa el teléfono"
                inputMode="numeric"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Estado (opcional)</label>
              <Input value={state} onChange={(e) => setState(e.target.value)} autoComplete="off" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" variant="brand" loading={save.isPending} disabled={!canSave}>
                Guardar cambios
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function OrderCard({ order }: { order: OrderDTO }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState<'reject' | 'cancel' | null>(null);
  // Confirmación de pago (método + nota) y liberación de boletos.
  const [payOpen, setPayOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<OrderPaymentMethod>('efectivo');
  const [payNote, setPayNote] = useState('');
  const [releaseOpen, setReleaseOpen] = useState(false);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
    void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
  };

  const onError = (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Algo salió mal');

  // Cambia el estado de la orden en caché al instante (optimista) y revierte
  // si el servidor falla: en redes lentas el panel se siente inmediato.
  const optimisticStatus = <V = void,>(status: OrderDTO['status']) => ({
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
    onError: (e: unknown, _vars: V, ctx?: { previous: [QueryKey, { items: OrderDTO[] } | undefined][] }) => {
      ctx?.previous.forEach(([key, data]) => queryClient.setQueryData(key, data));
      onError(e);
    },
    onSettled: invalidate,
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
    giftNumbers: order.giftNumbers.join(', '),
    total: formatMXN(order.totalAmount),
    orderCode: order.code,
  });

  // Liga al BOLETO DIGITAL del cliente (página, no descarga). Funciona con el folio
  // de la orden o con el código del boleto: ambos resuelven en /boleto/:code.
  const ticketCode = order.digitalTicketCode ?? order.code;
  const ticketUrl = `${window.location.origin}/boleto/${ticketCode}`;
  const ticketWaMessage = waTicketReadyMessage({
    raffleName: `${order.raffleTitle} (${order.eventLabel})`,
    ticketNumbers: order.ticketNumbers.join(', '),
    buyerName: order.buyer.fullName,
    ticketUrl,
  });
  // Abre el chat del cliente en WhatsApp con el mensaje + liga del boleto ya escritos.
  // Se llama dentro del gesto del clic para que el navegador no bloquee la pestaña.
  const sendTicketWa = () => {
    if (!waPhone) return;
    window.open(buildWhatsappLink(waPhone, ticketWaMessage, buyerDial), '_blank', 'noopener,noreferrer');
  };

  const markPaid = useMutation({
    mutationFn: (pay: { paymentMethod: OrderPaymentMethod; paymentNote: string }) =>
      orderService.markPaid(order.id, pay),
    ...optimisticStatus<{ paymentMethod: OrderPaymentMethod; paymentNote: string }>('PAID'),
    onSuccess: () => {
      setPayOpen(false);
      toast.success(waPhone ? 'Pagado. Boleto enviado al cliente por WhatsApp' : 'Orden marcada como pagada');
    },
  });

  // Liberar boletos (de vuelta a la venta o a apartado). Sin optimismo: cambia
  // estado + boletos, así que basta con invalidar la lista al terminar.
  const release = useMutation({
    mutationFn: (target: 'available' | 'reserved') => orderService.release(order.id, target),
    onSuccess: (_res, target) => {
      invalidate();
      setReleaseOpen(false);
      toast.success(target === 'available' ? 'Boletos liberados a la venta' : 'Orden devuelta a apartado');
    },
    onError,
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
          {order.buyer.state && (
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{order.buyer.state}</span>
            </p>
          )}
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

      {order.paymentMethod && (
        <p className="text-xs text-muted-foreground">
          💵 Pagado en{' '}
          <span className="font-semibold text-foreground">
            {PAYMENT_METHOD_LABEL[order.paymentMethod as OrderPaymentMethod] ?? order.paymentMethod}
          </span>
          {order.paymentNote ? ` · ${order.paymentNote}` : ''}
        </p>
      )}

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
            // Doble confirmación: abre el diálogo para capturar cómo se pagó antes
            // de confirmar (evita marcar pagado por accidente).
            onClick={() => setPayOpen(true)}
          >
            Marcar pagado
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {order.digitalTicketCode ? (
          <>
            {/* Pagada: reenviar el boleto al cliente y abrirlo como link. */}
            <WhatsAppButton
              phone={waPhone}
              dialCode={buyerDial}
              message={ticketWaMessage}
              size="sm"
              label="Enviar boleto"
            />
            <Button asChild variant="outline" size="sm">
              <a href={`/boleto/${order.digitalTicketCode}`} target="_blank" rel="noopener noreferrer">
                Ver boleto
              </a>
            </Button>
          </>
        ) : (
          <WhatsAppButton phone={waPhone} dialCode={buyerDial} message={waMessage} size="sm" />
        )}
        <EditBuyerDialog order={order} />
        {order.status === 'PAID' && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => setReleaseOpen(true)}
          >
            Liberar boletos
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

      {/* Doble confirmación de pago: captura cómo pagó el cliente antes de marcar. */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar pago</DialogTitle>
            <DialogDescription>
              ¿Confirmas que <span className="font-semibold">{order.buyer.fullName}</span> ya pagó{' '}
              <span className="font-semibold">{formatMXN(order.totalAmount)}</span>? Indica cómo pagó.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-semibold">¿Cómo pagó?</label>
              <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value as OrderPaymentMethod)}>
                {ORDER_PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {PAYMENT_METHOD_LABEL[m]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold">Detalles (opcional)</label>
              <Input
                value={payNote}
                onChange={(e) => setPayNote(e.target.value)}
                placeholder="Referencia, banco, quién recibió…"
                autoComplete="off"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setPayOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="success"
                loading={markPaid.isPending}
                // El WhatsApp se abre dentro del gesto del clic (no lo bloquea el navegador).
                onClick={() => {
                  sendTicketWa();
                  markPaid.mutate({ paymentMethod: payMethod, paymentNote: payNote.trim() });
                }}
              >
                Sí, confirmar pago
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Liberar boletos: de vuelta a la venta o a apartado. */}
      <Dialog open={releaseOpen} onOpenChange={setReleaseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar boletos</DialogTitle>
            <DialogDescription>
              Elige qué hacer con los {order.ticketNumbers.length + order.giftNumbers.length} números de la orden{' '}
              <span className="font-mono font-semibold">{order.code}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="h-auto w-full flex-col items-start gap-0.5 whitespace-normal py-3 text-left"
              loading={release.isPending && release.variables === 'reserved'}
              onClick={() => release.mutate('reserved')}
            >
              <span className="font-bold">Volver a apartado</span>
              <span className="text-xs font-normal text-muted-foreground">
                El cliente conserva sus boletos, pero la orden queda pendiente de pago.
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto w-full flex-col items-start gap-0.5 whitespace-normal py-3 text-left"
              loading={release.isPending && release.variables === 'available'}
              onClick={() => release.mutate('available')}
            >
              <span className="font-bold text-destructive">Liberar a la venta</span>
              <span className="text-xs font-normal text-muted-foreground">
                Los boletos vuelven a estar disponibles para cualquiera. La orden se cancela.
              </span>
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setReleaseOpen(false)}>
              Cancelar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
  // La búsqueda viaja al backend con un retraso para no consultar en cada tecla.
  // El backend busca por folio, nombre, teléfono, rifa y NÚMERO DE BOLETO (así
  // encuentra la orden aunque sea vieja, no solo entre las recientes cargadas).
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  // Filtro por vendedor (solo admin): 'all' | 'direct' | <sellerId>.
  const [sellerFilter, setSellerFilter] = useState<string>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const urlFilter: UrlFilter =
    params.filter && params.filter in URL_TO_API ? (params.filter as UrlFilter) : 'pendientes';
  const apiFilter = URL_TO_API[urlFilter];

  const ordersQuery = useQuery({
    queryKey: ['orders', apiFilter, debouncedSearch],
    queryFn: () => orderService.list(apiFilter, undefined, debouncedSearch || undefined),
    // Mantiene la lista anterior mientras llega la búsqueda nueva (sin parpadeo).
    placeholderData: (prev) => prev,
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

  // Filtro instantáneo del cliente (folio, nombre, teléfono, rifa y número de
  // boleto manual o de regalo) sobre lo ya cargado, + filtro por vendedor. La
  // búsqueda completa la hace el backend; esto solo afina al instante mientras se teclea.
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
        o.raffleTitle.toLowerCase().includes(q) ||
        o.ticketNumbers.some((t) => t.includes(q)) ||
        o.giftNumbers.some((t) => t.includes(q))
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
          placeholder="Buscar por boleto, nombre, teléfono, folio o rifa"
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
