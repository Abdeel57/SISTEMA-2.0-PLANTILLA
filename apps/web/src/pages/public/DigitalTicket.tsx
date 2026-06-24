import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import {
  Download,
  ShieldCheck,
  Ticket as TicketIcon,
  AlertCircle,
  Home,
  WifiOff,
  Trophy,
  CalendarDays,
} from 'lucide-react';
import { BRAND, formatMXN, formatDateTimeMX, formatDateMX } from '@bismark/shared';
import { apiAssetUrl } from '@/lib/api';
import { publicService } from '@/services/publicSite';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BrandLoader } from '@/components/brand/BrandLoader';
import { OrderStatusBadge } from '@/lib/statusBadges';
import { VerifiedBadge } from '@/components/brand/VerifiedBadge';
import { RiferoTheme } from '@/components/brand/RiferoTheme';
import { QrCode } from '@/components/public/QrCode';
import { PaymentSection } from '@/components/public/PaymentSection';
import { useOfflineTicket } from '@/lib/offline/useOfflineTicket';

// Logo del rifero (o inicial como respaldo). Reutilizado en la cabecera de la
// página y dentro del propio boleto para que el artefacto compartido se sienta
// 100% del organizador.
function BrandLogo({
  logoUrl,
  name,
  size,
  glow,
}: {
  logoUrl?: string | null;
  name: string;
  size: number;
  glow?: boolean;
}) {
  const glowFilter = glow
    ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.25)) drop-shadow(0 0 4px color-mix(in srgb, var(--rifero-primary) 45%, transparent))'
    : 'drop-shadow(0 1px 2px rgba(0,0,0,0.18))';
  if (logoUrl) {
    return (
      <img
        src={apiAssetUrl(logoUrl)}
        alt={name}
        className="object-contain"
        style={{ width: size, height: size, filter: glowFilter }}
      />
    );
  }
  return (
    <div
      className="grid place-items-center rounded-full bg-[var(--rifero-primary)] font-black text-white"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function DigitalTicket() {
  const { code = '' } = useParams<{ code: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['digital-ticket', code],
    queryFn: () => publicService.digitalTicket(code),
    enabled: !!code,
    // Sin señal no insistas: caemos rápido a la copia offline (IndexedDB).
    retry: 1,
    networkMode: 'always',
  });

  // Offline-first: guarda el boleto al cargarlo con red y lo recupera sin señal.
  const { ticket, savedAt, fromCache, checking } = useOfflineTicket(code, {
    online: data?.ticket,
    networkFailed: isError,
  });

  return (
    <RiferoTheme primaryColor={ticket?.primaryColor} secondaryColor={ticket?.secondaryColor}>
      <div className="flex min-h-screen flex-col bg-muted/30">
        {/* Encabezado con la marca del organizador */}
        <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur safe-top">
          <div className="mx-auto flex h-14 max-w-2xl items-center justify-center px-4">
            {ticket ? (
              <Link to="/" className="inline-flex items-center gap-2">
                <BrandLogo
                  logoUrl={ticket.riferoLogoUrl}
                  name={ticket.riferoPublicName}
                  size={32}
                  glow={ticket.logoGlow}
                />
                <span className="font-display text-lg font-extrabold tracking-tight">
                  {ticket.riferoPublicName}
                </span>
                {ticket.riferoVerified && <VerifiedBadge size={18} />}
              </Link>
            ) : (
              <span className="font-display text-lg font-extrabold tracking-tight text-muted-foreground">
                {BRAND.name}
              </span>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
          {(isLoading || checking) && !ticket ? (
            <BrandLoader fullScreen={false} />
          ) : !ticket ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="grid h-16 w-16 place-items-center rounded-full bg-muted">
                  <AlertCircle className="h-8 w-8 text-muted-foreground" />
                </div>
                <h1 className="text-2xl font-extrabold">Boleto no disponible</h1>
                <p className="max-w-xs text-base text-muted-foreground">
                  No encontramos este boleto digital. Revisa que el enlace sea correcto.
                </p>
                <Button asChild variant="outline" size="lg" className="mt-2">
                  <Link to="/">
                    <Home className="h-4 w-4" />
                    Ir al inicio
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Indicador: guardado para verlo sin internet (tranquiliza al comprador) */}
              {fromCache ? (
                <div className="mb-4 flex items-center gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  <WifiOff className="h-7 w-7 shrink-0" />
                  <p className="text-base font-bold leading-tight">
                    Estás sin internet. Te mostramos tu boleto guardado.
                  </p>
                </div>
              ) : (
                savedAt && (
                  <div className="mb-4 flex items-center gap-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                    <ShieldCheck className="h-7 w-7 shrink-0" />
                    <p className="text-base font-bold leading-tight">Guardado para verlo sin internet</p>
                  </div>
                )
              )}

              {/* ── Boleto digital con marca del organizador ── */}
              <div className="overflow-hidden rounded-3xl bg-card shadow-xl ring-1 ring-border">
                {/* Cabecera con el color del rifero */}
                <div
                  className="relative overflow-hidden px-6 pb-6 pt-6 text-white"
                  style={{
                    background:
                      'linear-gradient(135deg, var(--rifero-primary) 0%, color-mix(in srgb, var(--rifero-primary) 62%, #000) 100%)',
                  }}
                >
                  {/* Glow decorativo */}
                  <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
                  <div className="relative flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/95 p-1.5 shadow-sm">
                        <BrandLogo logoUrl={ticket.riferoLogoUrl} name={ticket.riferoPublicName} size={36} />
                      </div>
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 text-sm font-extrabold leading-tight">
                          <span className="truncate">{ticket.riferoPublicName}</span>
                          {ticket.riferoVerified && <VerifiedBadge size={15} className="shrink-0" />}
                        </p>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold opacity-90">
                          <TicketIcon className="h-3.5 w-3.5" />
                          {ticket.eventLabel} · Boleto digital
                        </span>
                      </div>
                    </div>
                  </div>

                  <h1 className="relative mt-4 text-2xl font-extrabold leading-tight">{ticket.raffleTitle}</h1>
                  {ticket.rafflePrize && (
                    <p className="relative mt-1 flex items-center gap-1.5 text-sm font-semibold opacity-95">
                      <Trophy className="h-4 w-4 shrink-0" />
                      <span className="line-clamp-2">{ticket.rafflePrize}</span>
                    </p>
                  )}
                </div>

                {/* Línea perforada */}
                <div className="relative">
                  <div className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-muted/30" />
                  <div className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-muted/30" />
                  <div className="mx-5 border-t-2 border-dashed border-border" />
                </div>

                {/* Cuerpo */}
                <div className="px-6 py-5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Números de boleto
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {ticket.ticketNumbers.map((n) => (
                      <span
                        key={n}
                        className="rounded-lg px-3 py-1.5 text-lg font-extrabold tabular-nums"
                        style={{
                          color: 'var(--rifero-primary)',
                          backgroundColor: 'color-mix(in srgb, var(--rifero-primary) 12%, transparent)',
                        }}
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
                    <Row
                      label="Total"
                      value={<span className="font-extrabold">{formatMXN(ticket.totalAmount)}</span>}
                    />
                    <Row label="Fecha" value={formatDateTimeMX(ticket.createdAt)} />
                    {ticket.drawDate && (
                      <Row
                        label="Sorteo"
                        value={
                          <span className="inline-flex items-center gap-1.5">
                            <CalendarDays className="h-4 w-4 text-muted-foreground" />
                            {formatDateMX(ticket.drawDate)}
                          </span>
                        }
                      />
                    )}
                    <Row
                      label="Folio"
                      value={<span className="tabular-nums tracking-wide">{ticket.code}</span>}
                    />
                  </dl>

                  {/* Código QR para mostrar/escanear en el sorteo (funciona sin internet) */}
                  {ticket.verifyUrl && (
                    <div className="mt-6 flex flex-col items-center gap-2 border-t pt-5">
                      <div className="rounded-2xl bg-white p-3 ring-1 ring-border">
                        <QrCode value={ticket.verifyUrl} size={208} />
                      </div>
                      <p className="text-center text-sm font-semibold text-muted-foreground">
                        Muestra este código en el sorteo
                      </p>
                    </div>
                  )}
                </div>

                {/* Pie del boleto */}
                <div className="border-t bg-muted/40 px-6 py-4">
                  {/* El PDF y la verificación necesitan internet: se ocultan sin señal. */}
                  {ticket.pdfUrl && !fromCache && (
                    <Button asChild size="lg" className="w-full">
                      <a href={apiAssetUrl(ticket.pdfUrl)} target="_blank" rel="noopener noreferrer">
                        <Download className="h-5 w-5" />
                        Descargar PDF
                      </a>
                    </Button>
                  )}
                  {!fromCache && (
                    <a
                      href={ticket.verifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      Verificar autenticidad de este boleto
                    </a>
                  )}
                </div>
              </div>

              {/* ── Pago: resumen + datos del rifero + subir comprobante ── */}
              <PaymentSection ticket={ticket} offline={fromCache} />

              {/* Nota de marca discreta */}
              <p className="mt-6 text-center text-xs text-muted-foreground/70">{BRAND.generatedBy}</p>
            </>
          )}
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

// La sección de pago vive en `@/components/public/PaymentSection` (reutilizada
// por el boleto y por la página de pago del rifero).
