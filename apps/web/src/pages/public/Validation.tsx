import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Home } from 'lucide-react';
import { formatMXN, formatDateMX } from '@bismark/shared';
import { publicService } from '@/services/publicSite';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator, Skeleton } from '@/components/ui/misc';
import { OrderStatusBadge } from '@/lib/statusBadges';
import { Logo } from '@/components/brand/Logo';
import { PoweredBy } from '@/components/brand/PoweredBy';

export default function Validation() {
  const { code = '' } = useParams<{ code: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['validate', code],
    queryFn: () => publicService.validate(code),
    enabled: !!code,
  });

  return (
    <div className="flex min-h-screen flex-col bg-muted/20">
      {/* Encabezado de plataforma */}
      <header className="sticky top-0 z-30 border-b bg-background/90 backdrop-blur safe-top">
        <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 lg:h-16 lg:max-w-5xl lg:px-6">
          <Link to="/">
            <Logo />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8 lg:max-w-xl lg:py-12">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold sm:text-3xl lg:text-4xl">Verificación de boleto</h1>
          <p className="mt-1 text-base text-muted-foreground">Folio consultado: {code}</p>
        </div>

        {isLoading ? (
          <Card aria-busy="true">
            <CardContent className="flex flex-col items-center gap-4 py-10">
              <Skeleton className="h-20 w-20 rounded-full" />
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-px w-full" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-3/4" />
              <span className="sr-only">Verificando boleto...</span>
            </CardContent>
          </Card>
        ) : isError || !data || !data.found ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <div className="grid h-20 w-20 place-items-center rounded-full bg-red-100 text-red-600 dark:bg-red-950">
                <XCircle className="h-12 w-12" />
              </div>
              <h2 className="text-2xl font-extrabold">Boleto no encontrado</h2>
              <p className="max-w-xs text-base text-muted-foreground">
                No encontramos ningún boleto con este folio. Verifica que esté escrito correctamente.
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
          <Card>
            <CardContent className="py-8">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950">
                  <CheckCircle2 className="h-12 w-12" />
                </div>
                <h2 className="text-xl font-extrabold">Boleto válido</h2>
                {data.status && <OrderStatusBadge status={data.status} />}
              </div>

              <Separator className="my-6" />

              <dl className="space-y-4 text-base">
                {data.riferoPublicName && (
                  <Row label="Rifero" value={data.riferoPublicName} />
                )}
                {data.raffleTitle && (
                  <Row
                    label="Rifa"
                    value={
                      <span>
                        {data.eventLabel && (
                          <span className="mr-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-extrabold text-primary-foreground">
                            {data.eventLabel}
                          </span>
                        )}
                        {data.raffleTitle}
                      </span>
                    }
                  />
                )}
                {data.ticketNumbers && data.ticketNumbers.length > 0 && (
                  <Row
                    label="Boletos"
                    value={<span className="tabular-nums">{data.ticketNumbers.join(', ')}</span>}
                  />
                )}
                {typeof data.totalAmount === 'number' && (
                  <Row label="Total" value={<span className="font-extrabold">{formatMXN(data.totalAmount)}</span>} />
                )}
                {data.createdAt && <Row label="Fecha" value={formatDateMX(data.createdAt)} />}
              </dl>
            </CardContent>
          </Card>
        )}

        <footer className="mt-10 flex justify-center">
          <PoweredBy />
        </footer>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
