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
import { formatDate, waProofMessage, waReserveMessage, dialCodeForCountry } from '@bismark/shared';
import { t, useT, useMoney, useLocale } from '@/store/site';
import { ApiError } from '@/lib/api';
import { prepareProofFile, isValidProof, PROOF_ACCEPT } from '@/lib/proofFile';
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
import { WhatsAppButton } from '@/components/brand/WhatsAppButton';
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
        <CheckCircle2 className="h-3.5 w-3.5" /> {t('status.paid')}
      </span>
    );
  }
  if (isPending(status)) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        <Clock className="h-3.5 w-3.5" /> {t('status.pending')}
      </span>
    );
  }
  if (status === 'EXPIRED' || status === 'REJECTED' || status === 'CANCELLED') {
    const label =
      status === 'EXPIRED' ? t('status.expired') : status === 'REJECTED' ? t('status.rejected') : t('status.cancelled');
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
  const tr = useT();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!isValidProof(file)) {
      toast.error(tr('proof.badFile'));
      return;
    }
    setUploading(true);
    try {
      // Se comprime/convierte antes de subir (ver lib/proofFile.ts): las fotos
      // del teléfono pesan de más y el HEIC del iPhone no lo abre cualquiera.
      await publicService.uploadProof(orderCode, await prepareProofFile(file));
      toast.success(tr('proof.sentToast'));
      onUploaded();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : tr('proof.failed'));
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
        {tr('proof.upload')}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={PROOF_ACCEPT}
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
  whatsapp,
  whatsappCountry,
  whatsappName,
  buyerPhone,
  allowProofUpload,
  onChanged,
}: {
  order: PublicOrderLookupItem;
  index: number;
  whatsapp: string | null;
  // País (lada +52/+1) y nombre de quien atiende el número al que se envía el pago.
  whatsappCountry?: string | null;
  whatsappName?: string | null;
  // Teléfono con el que el comprador buscó sus órdenes: va en el mensaje al rifero
  // para que identifique de quién es el pago.
  buyerPhone: string;
  // ¿El sitio recibe comprobantes? Si no, el pago se coordina por WhatsApp.
  allowProofUpload: boolean;
  onChanged: () => void;
}) {
  const tr = useT();
  const fmt = useMoney();
  const locale = useLocale();
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
              {order.code} · {formatDate(order.createdAt, locale)}
            </p>
          </div>
          <StatusPill status={order.status} />
        </div>

        {/* Boletos: chips estilo boleto (vencidas/rechazadas ya no tienen boletos) */}
        {order.ticketNumbers.length > 0 && (
        <div className="mt-3 rounded-xl border border-dashed p-2.5" style={{ borderColor: BRAND, background: BRAND_SOFT }}>
          <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
            {tr('verify.yourTickets')}
          </p>
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
            <p className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">
              {tr('ticket.total')}
            </p>
            <p className="font-ticket text-xl font-bold" style={{ color: BRAND }}>
              {fmt(order.totalAmount)}
            </p>
          </div>

          {order.status === 'PAID' && order.digitalTicketCode ? (
            <Link
              to={`/boleto/${order.digitalTicketCode}`}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 font-display text-xs font-extrabold uppercase tracking-wide text-white shadow-sm transition-transform active:scale-[0.98]"
              style={{ background: BRAND }}
            >
              {tr('verify.viewDigital')} <ArrowRight className="h-4 w-4" />
            </Link>
          ) : pending ? (
            // Si el sitio recibe comprobantes, se sube aquí; si no, se envía el
            // pago por WhatsApp al rifero (el backend rechaza la subida igual).
            allowProofUpload ? (
              <UploadProof orderCode={order.code} onUploaded={onChanged} />
            ) : whatsapp ? (
              <WhatsAppButton
                phone={whatsapp}
                dialCode={dialCodeForCountry(whatsappCountry)}
                size="sm"
                className="attn-pulse rounded-xl font-display text-xs font-extrabold uppercase tracking-wide"
                label={tr('verify.sendPayment')}
                message={waReserveMessage({
                  raffleName: order.raffleTitle,
                  ticketNumbers: order.ticketNumbers.join(', '),
                  total: fmt(order.totalAmount),
                  orderCode: order.code,
                  buyerPhone,
                  buyerState: order.buyerState,
                  locale,
                })}
              />
            ) : null
          ) : null}
        </div>

        {pending && order.hasProof && (
          <div className="mt-3 space-y-2">
            <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <Clock className="h-3.5 w-3.5 shrink-0" /> {tr('verify.proofSent')}
            </p>
            {/* Aviso directo al organizador por WhatsApp de que ya se pagó. */}
            {whatsapp && (
              <WhatsAppButton
                phone={whatsapp}
                dialCode={dialCodeForCountry(whatsappCountry)}
                className="w-full"
                label={whatsappName ? tr('verify.notifyTo', { name: whatsappName }) : tr('verify.notify')}
                message={waProofMessage({
                  raffleName: order.raffleTitle,
                  ticketNumbers: order.ticketNumbers.join(', '),
                  total: fmt(order.totalAmount),
                  orderCode: order.code,
                  buyerPhone,
                  buyerState: order.buyerState,
                  locale,
                })}
              />
            )}
          </div>
        )}

        {(order.status === 'EXPIRED' || order.status === 'REJECTED' || order.status === 'CANCELLED') && (
          <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {tr(
              order.status === 'EXPIRED'
                ? 'status.expiredMsg'
                : order.status === 'REJECTED'
                  ? 'status.rejectedMsg'
                  : 'status.cancelledMsg',
            )}
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
  const tr = useT();
  useDocumentTitle(tr('profile.verifyTickets'));

  const [mode, setMode] = useState<'phone' | 'name'>('phone');
  const [phone, setPhone] = useState('');
  const [name, setName] = useState('');
  const [ticket, setTicket] = useState('');
  const [result, setResult] = useState<PublicOrderLookupResult | null>(null);
  const [payOpen, setPayOpen] = useState(false);

  const riferoQuery = useQuery({
    queryKey: ['public-rifero', slug],
    queryFn: () => publicService.riferoBySubdomain(slug),
    enabled: !!slug,
  });
  const rifero = riferoQuery.data?.rifero ?? null;

  const lookup = useMutation({
    mutationFn: (params: { phone?: string; name?: string; ticket?: string }) =>
      publicService.lookupOrders(slug, params),
    onSuccess: (res) => setResult(res),
    onError: (e) => toast.error(e instanceof ApiError ? e.message : tr('verify.searchFailed')),
  });

  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get('tel');
    const tel = (fromUrl || recallBuyer()?.phone || '').trim();
    if (tel) {
      setPhone(tel);
      lookup.mutate({ phone: tel.replace(/\D/g, '') });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const search = () => {
    if (mode === 'phone') {
      const tel = phone.replace(/\D/g, '');
      if (tel.length < 10) {
        toast.error(tr('verify.needPhone'));
        return;
      }
      lookup.mutate({ phone: tel });
    } else {
      const nm = name.trim();
      const tk = ticket.trim();
      if (nm.length < 2 || tk.length < 1) {
        toast.error(tr('verify.needNameTicket'));
        return;
      }
      lookup.mutate({ name: nm, ticket: tk });
    }
  };

  const orders = result?.orders ?? [];
  // El sitio recibe comprobantes en la plataforma sólo si el backend lo indica.
  const allowProofUpload = result?.allowProofUpload ?? false;
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
          left={{ line1: tr('bar.back.l1'), line2: tr('bar.back.l2'), href: backToBuyHref }}
          right={{ line1: tr('bar.pay.l1'), line2: tr('bar.pay.l2'), onClick: () => setPayOpen(true) }}
        />

        {/* ── Hero del título con acento de marca ── */}
        <div className="relative overflow-hidden border-b">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full opacity-[0.18] blur-3xl"
            style={{ background: BRAND }}
          />
          {/* En PC el bloque de búsqueda se centra: a todo lo ancho quedaría
              desbalanceado contra el espacio vacío de la derecha. */}
          <div className="relative mx-auto max-w-2xl px-4 pb-6 pt-7 lg:max-w-6xl lg:px-6 lg:pb-10 lg:pt-12 lg:text-center">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-display text-[11px] font-extrabold uppercase tracking-wide"
              style={{ background: BRAND_SOFT, color: BRAND }}
            >
              <Wallet className="h-3.5 w-3.5" /> {tr('verify.badge')}
            </span>
            <h1 className="mt-3 font-display text-3xl font-extrabold uppercase leading-[0.95] tracking-tight sm:text-4xl lg:text-5xl">
              {tr('verify.title1')} <span style={{ color: BRAND }}>{tr('verify.title2')}</span>
            </h1>
            <p className="mt-2 max-w-md text-sm text-muted-foreground lg:mx-auto lg:text-base">
              {tr('verify.desc')}
            </p>

            {/* Selector de modo de búsqueda */}
            <div className="mt-4 inline-flex rounded-xl border bg-card p-1">
              {(
                [
                  { key: 'phone', label: tr('verify.byPhone') },
                  { key: 'name', label: tr('verify.byName') },
                ] as const
              ).map((m) => {
                const active = mode === m.key;
                return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMode(m.key)}
                    className="rounded-lg px-3.5 py-1.5 font-display text-xs font-extrabold uppercase tracking-wide transition-colors"
                    style={active ? { background: BRAND, color: '#fff' } : { color: 'var(--muted-foreground)' }}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>

            {/* Buscador */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                search();
              }}
              className="mt-3 flex flex-col gap-2 sm:flex-row lg:mx-auto lg:max-w-2xl lg:text-left"
            >
              {mode === 'phone' ? (
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    inputMode="tel"
                    placeholder={tr('verify.phonePlaceholder')}
                    className="h-12 w-full rounded-xl border-2 border-input bg-card pl-10 pr-3 font-ticket text-base tracking-tight outline-none transition-colors placeholder:font-sans placeholder:text-muted-foreground focus:border-[var(--rifero-primary)]"
                  />
                </div>
              ) : (
                <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={tr('verify.namePlaceholder')}
                    className="h-12 w-full flex-1 rounded-xl border-2 border-input bg-card px-3.5 text-base tracking-tight outline-none transition-colors placeholder:text-muted-foreground focus:border-[var(--rifero-primary)]"
                  />
                  <input
                    value={ticket}
                    onChange={(e) => setTicket(e.target.value)}
                    inputMode="numeric"
                    placeholder={tr('verify.ticketPlaceholder')}
                    className="h-12 w-full rounded-xl border-2 border-input bg-card px-3.5 font-ticket text-base tracking-tight outline-none transition-colors placeholder:font-sans placeholder:text-muted-foreground focus:border-[var(--rifero-primary)] sm:w-36"
                  />
                </div>
              )}
              <Button
                type="submit"
                loading={lookup.isPending}
                className="h-12 shrink-0 rounded-xl px-5 font-display font-extrabold uppercase tracking-wide text-white shadow-sm"
                style={{ background: BRAND }}
              >
                {tr('verify.search')}
              </Button>
            </form>
          </div>
        </div>

        {/* ── Resultados ── */}
        <div className="mx-auto max-w-2xl px-4 pt-6 lg:max-w-6xl lg:px-6 lg:pt-8">
          {lookup.isPending ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-8 w-8 animate-spin" style={{ color: BRAND }} />
              <p className="mt-3 text-sm font-semibold text-muted-foreground">{tr('verify.searching')}</p>
            </div>
          ) : hasSearched && orders.length === 0 ? (
            <div className="animate-reveal mx-auto max-w-sm py-12 text-center">
              <div
                className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl"
                style={{ background: BRAND_SOFT, color: BRAND }}
              >
                <Ticket className="h-8 w-8" />
              </div>
              <p className="font-display text-lg font-extrabold uppercase tracking-tight">{tr('verify.emptyTitle')}</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {tr(mode === 'phone' ? 'verify.emptyPhone' : 'verify.emptyName')}
              </p>
              <Button
                asChild
                variant="outline"
                className="mt-5 font-display font-extrabold uppercase"
                style={{ borderColor: BRAND, color: BRAND }}
              >
                <Link to={backToBuyHref}>
                  <ArrowLeft className="h-4 w-4" /> {tr('verify.goBuy')}
                </Link>
              </Button>
            </div>
          ) : orders.length > 0 ? (
            <>
              <p className="mb-3 font-display text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
                {orders.length} {tr(orders.length === 1 ? 'common.order' : 'common.orders')}
              </p>
              {/* En PC las órdenes van en dos columnas: se ven varias sin desplazar. */}
              <div className="grid gap-3.5 lg:grid-cols-2 lg:gap-5">
                {orders.map((o, i) => (
                  <OrderCard
                    key={o.code}
                    order={o}
                    index={i}
                    whatsapp={result?.paymentProfile?.whatsapp ?? rifero?.whatsapp ?? null}
                    whatsappCountry={
                      result?.paymentProfile?.whatsapp
                        ? result.paymentProfile.whatsappCountry
                        : rifero?.whatsappCountry
                    }
                    whatsappName={
                      result?.paymentProfile?.whatsapp ? result.paymentProfile.whatsappName : rifero?.whatsappName
                    }
                    buyerPhone={lookup.variables?.phone ?? ''}
                    allowProofUpload={allowProofUpload}
                    onChanged={() => search()}
                  />
                ))}
              </div>

              {hasPending && result?.paymentProfile && paymentHasData(result.paymentProfile) && (
                <div className="mt-7 lg:mx-auto lg:mt-10 lg:max-w-2xl">
                  <h2 className="mb-2.5 font-display text-base font-extrabold uppercase tracking-tight lg:text-center lg:text-xl">
                    {tr('verify.owe')}
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
            <DialogTitle className="font-display uppercase tracking-tight">{tr('pay.title')}</DialogTitle>
            <DialogDescription>{tr('pay.descVerify')}</DialogDescription>
          </DialogHeader>
          {result?.paymentProfile && paymentHasData(result.paymentProfile) ? (
            <PaymentCard pay={result.paymentProfile} />
          ) : (
            <p className="text-sm text-muted-foreground">{tr('pay.searchFirst')}</p>
          )}
        </DialogContent>
      </Dialog>
    </RiferoTheme>
  );
}
