import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { Ticket as TicketIcon, AlertCircle, ShieldCheck, WifiOff, Home } from 'lucide-react';
import { formatDateTimeMX, formatMXN, buildWhatsappLink, waReserveMessage } from '@bismark/shared';
import { publicService } from '@/services/publicSite';
import { BrandLoader } from '@/components/brand/BrandLoader';
import { Button } from '@/components/ui/button';
import { OrderStatusBadge } from '@/lib/statusBadges';
import { RiferoTheme } from '@/components/brand/RiferoTheme';
import { RiferoTopBar } from '@/components/public/RiferoTopBar';
import { PoweredBy } from '@/components/brand/PoweredBy';
import { QrCode } from '@/components/public/QrCode';
import { PaymentSection } from '@/components/public/PaymentSection';
import { useOfflineTicket } from '@/lib/offline/useOfflineTicket';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

// Página de pago CON LA MARCA DEL RIFERO (no la de Bismark). El comprador llega
// aquí tras apartar, y desde el botón "SUBE TU PAGO AQUÍ". Muestra arriba el
// verificador del boleto, luego el resumen, MÉTODOS DE PAGO y SUBE TU PAGO AQUÍ.
export default function RiferoPayment() {
  const { code = '' } = useParams<{ code: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['digital-ticket', code],
    queryFn: () => publicService.digitalTicket(code),
    enabled: !!code,
    retry: 1,
    networkMode: 'always',
  });

  // Offline-first: guarda el boleto con red y lo recupera sin señal.
  const { ticket, savedAt, fromCache, checking } = useOfflineTicket(code, {
    online: data?.ticket,
    networkFailed: isError,
  });

  useDocumentTitle(ticket ? `Tu pago · ${ticket.riferoPublicName}` : undefined);

  if ((isLoading || checking) && !ticket) {
    return <BrandLoader />;
  }

  if (!ticket) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-muted">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-extrabold">No encontramos tu pago</h1>
          <p className="mt-2 text-base text-muted-foreground">
            Revisa que el enlace o el folio sean correctos.
          </p>
          <Button asChild variant="outline" size="lg" className="mt-6">
            <Link to="/">
              <Home className="h-4 w-4" /> Ir al inicio
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Si el sitio NO recibe comprobantes, el acceso "Sube tu pago aquí" se vuelve
  // "Envía tu pago" y abre WhatsApp del rifero para coordinar el pago.
  const sendPayByWhatsapp = !ticket.allowProofUpload && !!ticket.riferoWhatsapp;
  const topBarRight = sendPayByWhatsapp
    ? {
        rightLine1: 'Envía tu',
        rightLine2: 'pago',
        rightHref: buildWhatsappLink(
          ticket.riferoWhatsapp as string,
          waReserveMessage({
            raffleName: ticket.raffleTitle,
            ticketNumbers: ticket.ticketNumbers.join(', '),
            total: formatMXN(ticket.totalAmount),
            orderCode: ticket.orderCode,
            buyerState: ticket.buyerState,
          }),
        ),
      }
    : {};

  return (
    <RiferoTheme primaryColor={ticket.primaryColor} secondaryColor={ticket.secondaryColor}>
      <div className="min-h-screen bg-background pb-12">
        <RiferoTopBar
          logoUrl={ticket.riferoLogoUrl}
          publicName={ticket.riferoPublicName}
          verified={ticket.riferoVerified}
          logoGlow={ticket.logoGlow}
          {...topBarRight}
        />

        <main className="mx-auto w-full max-w-md px-4 py-6">
          {/* Indicador offline / guardado */}
          {fromCache ? (
            <div className="mb-4 flex items-center gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <WifiOff className="h-7 w-7 shrink-0" />
              <p className="text-base font-bold leading-tight">Estás sin internet. Te mostramos tu boleto guardado.</p>
            </div>
          ) : (
            savedAt && (
              <div className="mb-4 flex items-center gap-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                <ShieldCheck className="h-7 w-7 shrink-0" />
                <p className="text-base font-bold leading-tight">Guardado para verlo sin internet</p>
              </div>
            )
          )}

          {/* ── Verificador del boleto (con los colores del rifero) ── */}
          <div className="overflow-hidden rounded-3xl bg-card shadow-xl ring-1 ring-border">
            <div className="bg-[var(--rifero-primary,#1A4DFF)] px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-semibold opacity-90">
                  <TicketIcon className="h-4 w-4" /> Boleto digital
                </span>
                <span className="rounded-md bg-white/20 px-2 py-0.5 text-xs font-extrabold">{ticket.eventLabel}</span>
              </div>
              <h1 className="mt-2 text-xl font-extrabold leading-tight">{ticket.raffleTitle}</h1>
              <p className="text-sm opacity-90">{ticket.riferoPublicName}</p>
            </div>

            <div className="relative">
              <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-muted/30" />
              <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-muted/30" />
              <div className="mx-5 border-t-2 border-dashed border-border" />
            </div>

            <div className="px-6 py-5">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Números de boleto</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ticket.ticketNumbers.map((n) => (
                  <span
                    key={n}
                    className="rounded-lg bg-muted px-3 py-1.5 text-lg font-extrabold tabular-nums text-[var(--rifero-primary,#1A4DFF)]"
                  >
                    {n}
                  </span>
                ))}
              </div>

              <dl className="mt-5 space-y-3 text-sm">
                <Row label="A nombre de" value={ticket.buyerName} />
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-muted-foreground">Estado</dt>
                  <dd>
                    <OrderStatusBadge status={ticket.status} />
                  </dd>
                </div>
                <Row label="Folio" value={<span className="tabular-nums tracking-wide">{ticket.code}</span>} />
                <Row label="Fecha" value={formatDateTimeMX(ticket.createdAt)} />
              </dl>

              {ticket.verifyUrl && (
                <div className="mt-6 flex flex-col items-center gap-2 border-t pt-5">
                  <div className="rounded-2xl bg-white p-3 ring-1 ring-border">
                    <QrCode value={ticket.verifyUrl} size={200} />
                  </div>
                  <p className="text-center text-sm font-semibold text-muted-foreground">
                    Muestra este código en el sorteo
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Pago: resumen + MÉTODOS DE PAGO + SUBE TU PAGO AQUÍ ── */}
          <PaymentSection ticket={ticket} offline={fromCache} />

          {/* Crédito discreto de Bismark (la página se siente del rifero) */}
          <div className="mt-8">
            <PoweredBy />
          </div>
        </main>
      </div>
    </RiferoTheme>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
