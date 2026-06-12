import { useQuery } from '@tanstack/react-query';
import { Check, Crown, Sparkles, Ticket, ShieldCheck } from 'lucide-react';
import {
  formatMXN,
  SUBSCRIPTION_STATUS_LABELS,
  type PlanDTO,
} from '@bismark/shared';
import { riferoService } from '@/services/riferos';
import { planService } from '@/services/plans';
import { PanelIntro } from '@/components/owner/PanelKit';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator, PageLoader } from '@/components/ui/misc';
import { WhatsAppButton } from '@/components/brand/WhatsAppButton';

const SUPPORT_PHONE = '5550000000';

function planLimits(plan: PlanDTO): string[] {
  const limits: string[] = [];
  limits.push(
    plan.maxActiveRaffles > 0
      ? `Hasta ${plan.maxActiveRaffles} rifa(s) activa(s)`
      : 'Rifas activas ilimitadas',
  );
  limits.push(
    plan.maxTicketsPerRaffle > 0
      ? `Hasta ${plan.maxTicketsPerRaffle.toLocaleString('es-MX')} boletos por rifa`
      : 'Boletos por rifa ilimitados',
  );
  if (plan.allowProofUpload) limits.push('Subida de comprobantes');
  if (plan.allowMultipleWinners) limits.push('Múltiples ganadores');
  if (plan.allowReportsExcel) limits.push('Reportes en Excel');
  if (plan.allowReportsPdf) limits.push('Reportes en PDF');
  if (plan.allowVerificationBadge) limits.push('Insignia de verificado');
  if (plan.allowDigitalDraw) limits.push('Sorteo digital');
  return limits;
}

export default function Plan() {
  const profileQuery = useQuery({
    queryKey: ['rifero-me'],
    queryFn: riferoService.me,
  });

  const plansQuery = useQuery({
    queryKey: ['plans'],
    queryFn: planService.list,
  });

  const profile = profileQuery.data?.profile;
  const plans = plansQuery.data?.items ?? [];
  const hasActivePlan = profile?.hasActivePlan ?? false;
  const activePlanId = profile?.activePlan?.id ?? null;
  const subscriptionStatus = profile?.subscriptionStatus;

  const supportMessage =
    'Hola, soy rifero en Bismark y quiero activar un plan para publicar mi página. ' +
    (profile ? `Mi página es ${profile.publicName} (${profile.slug}).` : '');

  if (profileQuery.isLoading || plansQuery.isLoading) {
    return <PageLoader />;
  }

  return (
    <div>
      <PanelIntro description="Tu suscripción y los planes disponibles." />

      {/* Estado actual */}
      <Card className="mb-5">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-500" />
              <span className="font-bold">Estado de tu suscripción</span>
            </div>
            {subscriptionStatus ? (
              <Badge variant={hasActivePlan ? 'success' : 'warning'}>
                {SUBSCRIPTION_STATUS_LABELS[subscriptionStatus]}
              </Badge>
            ) : (
              <Badge variant="muted">Sin plan</Badge>
            )}
          </div>

          {hasActivePlan && profile?.activePlan ? (
            <p className="text-sm text-muted-foreground">
              Tu plan actual es <span className="font-semibold text-foreground">{profile.activePlan.name}</span>.
              Tu página ya es visible para tus compradores.
            </p>
          ) : (
            <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-3 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
              <p className="text-sm">
                Tu página ya está lista. Para que los cambios sean visibles públicamente y puedas
                recibir compradores, activa un plan de Bismark.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Planes */}
      <h2 className="mb-3 text-base font-extrabold tracking-tight">Planes disponibles</h2>
      <div className="grid gap-4">
        {plans.map((plan) => {
          const isCurrent = plan.id === activePlanId;
          return (
            <Card
              key={plan.id}
              className={isCurrent ? 'border-primary/50 ring-1 ring-primary/30' : undefined}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2">
                    <Ticket className="h-5 w-5 text-primary" />
                    {plan.name}
                  </CardTitle>
                  {isCurrent && <Badge variant="success">Tu plan</Badge>}
                </div>
                <p className="mt-1 text-3xl font-extrabold tracking-tight">
                  {formatMXN(plan.price)}
                  <span className="text-sm font-medium text-muted-foreground"> / mes</span>
                </p>
                {plan.priceYearly != null && (
                  <p className="text-sm font-medium text-emerald-600">
                    o {formatMXN(plan.priceYearly)} al año (2 meses gratis)
                  </p>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <ul className="flex flex-col gap-2">
                  {planLimits(plan).map((limit) => (
                    <li key={limit} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{limit}</span>
                    </li>
                  ))}
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Activación manual */}
      <Card className="mt-6 border-dashed">
        <CardContent className="flex flex-col gap-3 p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="font-bold">¿Cómo activo mi plan?</span>
          </div>
          <p className="text-sm text-muted-foreground">
            En esta primera versión, la activación de tu plan la realiza manualmente el equipo de
            Bismark. Escríbenos por WhatsApp con el plan que quieres y te ayudamos a activarlo.
          </p>
          <Separator />
          <WhatsAppButton
            phone={SUPPORT_PHONE}
            message={supportMessage}
            label="Solicitar activación por WhatsApp"
            size="lg"
            className="w-full"
          />
        </CardContent>
      </Card>
    </div>
  );
}
