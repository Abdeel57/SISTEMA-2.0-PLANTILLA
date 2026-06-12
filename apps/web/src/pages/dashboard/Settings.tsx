import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Save, Clock, Upload, Trophy, Sparkles, Lock } from 'lucide-react';
import { updateRiferoSchema } from '@bismark/shared';
import { riferoService } from '@/services/riferos';
import { ApiError } from '@/lib/api';
import { PanelIntro } from '@/components/owner/PanelKit';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator, PageLoader } from '@/components/ui/misc';
import { PushToggle } from '@/components/owner/PushToggle';
import { toast } from 'sonner';

const settingsSchema = updateRiferoSchema.pick({
  defaultReserveMinutes: true,
  allowProofUpload: true,
  showWinners: true,
  useDigitalDraw: true,
});
type SettingsForm = z.infer<typeof settingsSchema>;

// Atajos de tiempo de apartado: escribir "1440" en un teléfono es tedioso.
const RESERVE_PRESETS = [
  { label: '1 hora', minutes: 60 },
  { label: '2 horas', minutes: 120 },
  { label: '6 horas', minutes: 360 },
  { label: '24 horas', minutes: 1440 },
  { label: '3 días', minutes: 4320 },
];

function humanMinutes(min: number): string {
  if (!min || Number.isNaN(min)) return '';
  if (min < 60) return `${min} minuto${min === 1 ? '' : 's'}`;
  if (min < 1440) {
    const h = Math.round((min / 60) * 10) / 10;
    return `${h} hora${h === 1 ? '' : 's'}`;
  }
  const d = Math.round((min / 1440) * 10) / 10;
  return `${d} día${d === 1 ? '' : 's'}`;
}

interface ToggleRowProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  note?: string;
}

function ToggleRow({ icon: Icon, title, description, checked, onChange, disabled, note }: ToggleRowProps) {
  return (
    <div className="flex items-start gap-3 py-1">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold leading-tight">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
        {disabled && note && (
          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Lock className="h-3 w-3" />
            {note}
          </p>
        )}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();

  const profileQuery = useQuery({
    queryKey: ['rifero-me'],
    queryFn: riferoService.me,
  });
  const profile = profileQuery.data?.profile;
  const planAllowsProof = profile?.activePlan?.allowProofUpload ?? false;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      defaultReserveMinutes: 120,
      allowProofUpload: false,
      showWinners: true,
      useDigitalDraw: false,
    },
  });

  useEffect(() => {
    if (profile) {
      reset({
        defaultReserveMinutes: profile.defaultReserveMinutes,
        allowProofUpload: profile.allowProofUpload,
        showWinners: profile.showWinners,
        useDigitalDraw: profile.useDigitalDraw,
      });
    }
  }, [profile, reset]);

  const updateMutation = useMutation({
    mutationFn: (values: SettingsForm) => riferoService.update(values),
    onSuccess: (res) => {
      toast.success('Ajustes guardados');
      void queryClient.invalidateQueries({ queryKey: ['rifero-me'] });
      reset({
        defaultReserveMinutes: res.profile.defaultReserveMinutes,
        allowProofUpload: res.profile.allowProofUpload,
        showWinners: res.profile.showWinners,
        useDigitalDraw: res.profile.useDigitalDraw,
      });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Algo salió mal'),
  });

  const onSubmit = (values: SettingsForm) => {
    updateMutation.mutate({
      ...values,
      allowProofUpload: planAllowsProof ? values.allowProofUpload : false,
    });
  };

  if (profileQuery.isLoading) {
    return <PageLoader />;
  }

  return (
    <div>
      <PanelIntro description="Ajustes que se aplican por defecto a tus nuevas rifas." />

      {/* Avisos push del rifero (este dispositivo). El comprador no recibe push. */}
      <div className="mb-4">
        <PushToggle />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Card>
          <CardContent className="flex flex-col gap-2 p-5">
            <Label htmlFor="defaultReserveMinutes" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Minutos para apartar un boleto
            </Label>
            <div className="flex flex-wrap gap-2">
              {RESERVE_PRESETS.map((p) => {
                const active = watch('defaultReserveMinutes') === p.minutes;
                return (
                  <button
                    key={p.minutes}
                    type="button"
                    onClick={() => setValue('defaultReserveMinutes', p.minutes, { shouldDirty: true })}
                    className={
                      active
                        ? 'rounded-full bg-brand px-3.5 py-2 text-sm font-bold text-white'
                        : 'rounded-full border px-3.5 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent'
                    }
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
            <Input
              id="defaultReserveMinutes"
              type="number"
              inputMode="numeric"
              min={5}
              max={10080}
              {...register('defaultReserveMinutes', { valueAsNumber: true })}
            />
            <p className="text-xs text-muted-foreground">
              Tiempo que un comprador tiene para pagar antes de que su apartado expire.
              {(() => {
                const eq = humanMinutes(Number(watch('defaultReserveMinutes')));
                return eq ? (
                  <>
                    {' '}
                    Ahora: <span className="font-semibold text-foreground">{eq}</span>.
                  </>
                ) : null;
              })()}
            </p>
            {errors.defaultReserveMinutes && (
              <p className="mt-1 text-sm text-destructive">{errors.defaultReserveMinutes.message}</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-4 p-5">
            <Controller
              control={control}
              name="allowProofUpload"
              render={({ field }) => (
                <ToggleRow
                  icon={Upload}
                  title="Permitir subir comprobantes"
                  description="Los compradores podrán adjuntar su comprobante de pago."
                  checked={planAllowsProof ? !!field.value : false}
                  onChange={field.onChange}
                  disabled={!planAllowsProof}
                  note="Tu plan actual no incluye esta función."
                />
              )}
            />
            <Separator />
            <Controller
              control={control}
              name="showWinners"
              render={({ field }) => (
                <ToggleRow
                  icon={Trophy}
                  title="Mostrar ganadores"
                  description="Publica a los ganadores en tu página pública."
                  checked={!!field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <Separator />
            <Controller
              control={control}
              name="useDigitalDraw"
              render={({ field }) => (
                <ToggleRow
                  icon={Sparkles}
                  title="Usar sorteo digital"
                  description="Realiza el sorteo dentro de Bismark de forma transparente."
                  checked={!!field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </CardContent>
        </Card>

        {/* Barra de guardar sticky: visible apenas hay cambios, sin perseguirla. */}
        <div className="sticky bottom-0 z-10 -mx-4 -mb-[max(1.25rem,env(safe-area-inset-bottom))] border-t bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-5 sm:px-5">
          {isDirty && (
            <p className="mb-2 text-center text-xs font-semibold text-amber-600 dark:text-amber-400">
              Tienes cambios sin guardar
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={updateMutation.isPending}
            disabled={!isDirty}
          >
            <Save className="h-5 w-5" />
            Guardar cambios
          </Button>
        </div>
      </form>
    </div>
  );
}
