import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Search,
  Ticket,
  Upload,
  Clock,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Wallet,
  XCircle,
} from 'lucide-react';
import { formatMXN, formatDateMX } from '@bismark/shared';
import { ApiError } from '@/lib/api';
import {
  publicService,
  type PublicOrderLookupItem,
  type PublicOrderLookupResult,
} from '@/services/publicSite';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { recallBuyer } from '@/lib/offline/buyerMemory';
import { RiferoTheme } from '@/components/brand/RiferoTheme';
import { RaffleBrandBar } from '@/components/public/RaffleBrandBar';
import { PaymentCard, paymentHasData } from '@/components/public/PaymentCard';
import { PoweredBy } from '@/components/brand/PoweredBy';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Props {
  subdomain?: string;
}

const BRAND = 'var(--rifero-primary)';
const BRAND_SOFT = 'color-mix(in srgb, var(--rifero-primary) 9%, transparent)';

const PENDING_STATUSES = ['RESERVED', 'PENDING'];
const isPending = (status: string) => PENDING_STATUSES.includes(status);

// ── Estado de la orden, como sello ──────────────────────────────
function StatusPill({ status }: { status: string }) {
  if (status === 'PAID') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" /> Pagada
      </span>
    );
  }
  if (isPending(status)) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        <Clock className="h-3.5 w-3.5" /> Pendiente
      </span>
    );
  }
  if (status === 'EXPIRED' || status === 'REJECTED' || status === 'CANCELLED') {
    const label = status === 'EXPIRED' ? 'Vencida' : status === 'REJECTED' ? 'Rechazada' : 'Cancelada';
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-red-700 dark:bg-red-950 dark:text-red-300">
        <XCircle className="h-3.5 w-3.5" /> {label}
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-extrabold uppercase text-muted-foreground">
      —
    </span>
  );
}

// ── Subir comprobante (reusa el endpoint del flujo de pago) ──────
function UploadProof({ orderCode, onUploaded }: { orderCode: string; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      await publicService.uploadProof(orderCode, file);
      toast.success('Comprobante enviado. El organizador lo revisará y confirmará tu pago.');
      onUploaded();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo enviar el comprobante');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="attn-pulse inline-flex items-center gap-2 rounded-xl border-2 bg-card px-3.5 py-2 font-display text-xs font-extrabold uppercase tracking-wide transition-colors hover:bg-[var(--rifero-primary)] hover:text-white active:scale-[0.98] disabled:opacity-60"
        style={{ borderColor: BRAND, color: BRAND }}
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        Subir comprobante
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
    </>
  );
}

// ── Tarjeta-stub de cada orden ──────────────────────────────────
function OrderCard({
  order,
  index,
  onChanged,
}: {
  order: PublicOrderLookupItem;
  index: number;
  onChanged: () => void;
}) {
  const pending = isPending(order.status);
  return (
    <article
      className="animate-reveal overflow-hidden rounded-2xl border bg-card shadow-sm"
      style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
    >
      <div className="h-1.5 w-full" style={{ background: BRAND }} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="rounded-md px-1.5 py-0.5 font-display text-[11px] font-extrabold text-white"
                style={{ background: BRAND }}
              >
                {order.eventLabel}
              </span>
              <h3 className="truncate font-display text-base font-extrabold uppercase tracking-tight">
                {order.raffleTitle}
              </h3>
            </div>
            <p className="mt-1 font-ticket text-[11px] text-muted-foreground">
              {order.code} · {formatDateMX(order.createdAt)}
            </p>
          </div>
          <StatusPill status={order.status} />
        </div>

        {/* Boletos: chips estilo boleto (vencidas/rechazadas ya no tienen boletos) */}
        {order.ticketNumbers.length > 0 && (
        <div className="mt-3 rounded-xl border border-dashed p-2.5" style={{ borderColor: BRAND, background: BRAND_SOFT }}>
          <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Tus boletos</p>
          <div className="flex flex-wrap gap-1.5">
            {order.ticketNumbers.map((n) => (
              <span
                key={n}
                className="rounded-md border bg-card px-2 py-0.5 font-ticket text-sm font-bold tabular-nums"
                style={{ borderColor: BRAND }}
              >
                {n}
              </span>
            ))}
          </div>
        </div>
        )}

        {/* Total + acción */}
        <div className="mt-3.5 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="font-ticket text-xl font-bold" style={{ color: BRAND }}>
              {formatMXN(order.totalAmount)}
            </p>
          </div>

          {order.status === 'PAID' && order.digitalTicketCode ? (
            <Link
              to={`/boleto/${order.digitalTicketCode}`}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-display text-xs font-extrabold uppercase tracking-wide text-white shadow-sm transition-transform active:scale-[0.98]"
              style={{ background: BRAND }}
            >
              Ver boleto digital <ArrowRight className="h-4 w-4" />
            </Link>
          ) : pending ? (
            <UploadProof orderCode={order.code} onUploaded={onChanged} />
          ) : null}
        </div>

        {pending && order.hasProof && (
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
            <Clock className="h-3.5 w-3.5 shrink-0" /> Comprobante enviado · esperando que el organizador confirme tu pago.
          </p>
        )}

        {(order.status === 'EXPIRED' || order.status === 'REJECTED' || order.status === 'CANCELLED') && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {order.status === 'EXPIRED'
              ? 'Tu apartado venció y los boletos se liberaron. Si siguen disponibles, vuelve a apartarlos.'
              : order.status === 'REJECTED'
                ? 'El organizador no validó este pago. Contáctalo si crees que es un error.'
                : 'Esta orden fue cancelada.'}
          </p>
        )}
      </div>
    </article>
  );
}

export default function VerifyTickets({ subdomain }: Props) {
  const params = useParams<{ slug: string }>();
  const slug = subdomain ?? params.slug ?? '';
  // Single-tenant: el perfil del rifero es la raíz del sitio.
  const riferoHref = '/';
  useDocumentTitle('Verificar mis boletos');

  const [phone, setPhone] = useState('');
  const [result, setResult] = useState<PublicOrderLookupResult | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  const riferoQuery = useQuery({
    queryKey: ['public-rifero', slug],
    queryFn: () => publicService.riferoBySubdomain(slug),
    enabled: !!slug,
  });
  const rifero = riferoQuery.data?.rifero ?? null;

  const lookup = useMutation({
    mutationFn: (tel: string) => publicService.lookupOrders(slug, tel),
    onSuccess: (res) => setResult(res),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo buscar'),
  });

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tel');
    const tel = (fromUrl || recallBuyer()?.phone || '').trim();
    if (tel) {
      setPhone(tel);
      lookup.mutate(tel.replace(/\D/g, ''));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const search = () => {
    const tel = phone.replace(/\D/g, '');
    if (tel.length < 10) {
      toast.error('Escribe tu teléfono a 10 dígitos');
      return;
    }
    lookup.mutate(tel);
  };

  const orders = result?.orders ?? [];
  const hasSearched = lookup.isSuccess || !!result;
  const hasPending = orders.some((o) => isPending(o.status));
  const backToBuyHref = orders[0] ? `/e${orders[0].eventNumber}` : riferoHref;

  return (
    <RiferoTheme primaryColor={rifero?.primaryColor} secondaryColor={rifero?.secondaryColor}>
      <div className="min-h-screen bg-background pb-16">
        <RaffleBrandBar
          logoUrl={rifero?.logoUrl}
          publicName={rifero?.publicName ?? 'Rifero'}
          verified={rifero?.verified}
          logoScale={rifero?.logoScale}
          logoGlow={rifero?.logoGlow}
          riferoHref={riferoHref}
          left={{ line1: 'Regresar', line2: 'a comprar', href: backToBuyHref }}
          right={{ line1: 'Métodos', line2: 'de pago', onClick: () => setPayOpen(true) }}
        />

        {/* ── Hero del título con acento de marca ── */}
        <div className="relative overflow-hidden border-b">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full opacity-[0.18] blur-3xl"
            style={{ background: BRAND }}
          />
          <div className="relative mx-auto max-w-2xl px-4 pb-6 pt-7">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-display text-[11px] font-extrabold uppercase tracking-wide"
              style={{ background: BRAND_SOFT, color: BRAND }}
            >
              <Wallet className="h-3.5 w-3.5" /> Tu billetera de boletos
            </span>
            <h1 className="mt-3 font-display text-3xl font-extrabold uppercase leading-[0.95] tracking-tight sm:text-4xl">
              Verificar <span style={{ color: BRAND }}>mis boletos</span>
            </h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Escribe tu teléfono para ver tus boletos apartados o pagados.
            </p>

            {/* Buscador */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                search();
              }}
              className="mt-5 flex gap-2"
            >
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="Tu teléfono (10 dígitos)"
                  className="h-12 w-full rounded-xl border-2 border-input bg-card pl-10 pr-3 font-ticket text-base tracking-tight outline-none transition-colors placeholder:font-sans placeholder:text-muted-foreground focus:border-[var(--rifero-primary)]"
                />
              </div>
              <Button
                type="submit"
                loading={lookup.isPending}
                className="h-12 shrink-0 rounded-xl px-5 font-display font-extrabold uppercase tracking-wide text-white shadow-sm"
                style={{ background: BRAND }}
              >
                Buscar
              </Button>
            </form>
          </div>
        </div>

        {/* ── Resultados ── */}
        <div className="mx-auto max-w-2xl px-4 pt-6">
          {lookup.isPending ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: BRAND }} />
              <p className="mt-3 text-sm font-semibold text-muted-foreground">Buscando tus boletos…</p>
            </div>
          ) : hasSearched && orders.length === 0 ? (
            <div className="animate-reveal mx-auto max-w-sm py-12 text-center">
              <div
                className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl"
                style={{ background: BRAND_SOFT, color: BRAND }}
              >
                <Ticket className="h-8 w-8" />
              </div>
              <p className="font-display text-lg font-extrabold uppercase tracking-tight">Sin boletos con ese número</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Revisa que sea el mismo teléfono con el que apartaste.
              </p>
              <Button
                asChild
                variant="outline"
                className="mt-5 font-display font-extrabold uppercase"
                style={{ borderColor: BRAND, color: BRAND }}
              >
                <Link to={backToBuyHref}>
                  <ArrowLeft className="h-4 w-4" /> Ir a comprar boletos
                </Link>
              </Button>
            </div>
          ) : orders.length > 0 ? (
            <>
              <p className="mb-3 font-display text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                {orders.length} {orders.length === 1 ? 'orden' : 'órdenes'}
              </p>
              <div className="grid gap-3.5">
                {orders.map((o, i) => (
                  <OrderCard key={o.code} order={o} index={i} onChanged={() => search()} />
                ))}
              </div>

              {hasPending && result?.paymentProfile && paymentHasData(result.paymentProfile) && (
                <div className="mt-7">
                  <h2 className="mb-2.5 font-display text-base font-extrabold uppercase tracking-tight">
                    ¿Debes boletos? Paga aquí
                  </h2>
                  <PaymentCard pay={result.paymentProfile} />
                </div>
              )}
            </>
          ) : null}

          <footer className="mt-14 flex justify-center border-t pt-6">
            <PoweredBy />
          </footer>
        </div>
      </div>

      {/* ── Diálogo: métodos de pago ── */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-tight">Métodos de pago</DialogTitle>
            <DialogDescription>Paga a estos datos y sube tu comprobante desde tu orden.</DialogDescription>
          </DialogHeader>
          {result?.paymentProfile && paymentHasData(result.paymentProfile) ? (
            <PaymentCard pay={result.paymentProfile} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Busca tus boletos con tu teléfono para ver los datos de pago, o contacta al rifero por WhatsApp.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </RiferoTheme>
  );
}
