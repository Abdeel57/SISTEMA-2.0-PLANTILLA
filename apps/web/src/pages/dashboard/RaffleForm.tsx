import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createRaffleSchema,
  formatTicketNumber,
  giftTicketRange,
  totalEmissions,
  type CreateRaffleInput,
  type RaffleDTO,
} from '@bismark/shared';
import { raffleService } from '@/services/raffles';
import { uploadService } from '@/services/uploads';
import { useAuthStore } from '@/store/auth';
import { buildRaffleUrl, buildRaffleShareUrl } from '@/lib/site';
import { ApiError, apiAssetUrl } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { PageLoader } from '@/components/ui/misc';
import { FormSection, Field } from '@/components/ui/form-section';
import { RichTextEditor } from '@/components/ui/rich-text';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';

const MAX_IMAGES = 8;

const STEPS = [
  { title: 'Tu rifa', desc: 'El nombre, el premio y lo que verán tus compradores.' },
  { title: 'Boletos y precio', desc: 'Cuántos boletos vendes, a qué precio y cómo se numeran.' },
  { title: 'Imágenes del premio', desc: 'Sube fotos. La primera será la principal.' },
  { title: 'Sorteo y pago', desc: 'La fecha del sorteo, las condiciones y cómo te pagan.' },
];

const STEP_FIELDS: (keyof CreateRaffleInput)[][] = [
  ['title', 'prize', 'description'],
  ['ticketPrice', 'totalTickets', 'ticketFormat', 'ticketStart', 'opportunities', 'maxTicketsPerOrder'],
  [],
  ['terms', 'paymentInstructions', 'priceListRows'],
];

function localToIso(local: string): string {
  if (!local) return '';
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}
function isoToLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function RaffleForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const topRef = useRef<HTMLDivElement>(null);
  const [images, setImages] = useState<string[]>([]);
  // Progreso de subida visible: "Subiendo 2 de 3…" en vez de un spinner mudo.
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
  const uploading = uploadProgress !== null;
  const [drawLocal, setDrawLocal] = useState('');
  const [drawError, setDrawError] = useState<string | undefined>(undefined);
  // Rifa recién creada → pantalla de éxito (publicar / ver / compartir).
  const [created, setCreated] = useState<RaffleDTO | null>(null);
  const slug = useAuthStore((s) => s.user?.slug) ?? undefined;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    trigger,
    formState: { errors },
  } = useForm<CreateRaffleInput>({
    resolver: zodResolver(createRaffleSchema),
    defaultValues: {
      title: '',
      description: '',
      prize: '',
      ticketPrice: 50,
      totalTickets: 100,
      ticketFormat: 3,
      ticketStart: 1,
      opportunities: 1,
      allowWinnerPublication: true,
      useDigitalDraw: false,
      showCountdown: true,
      priceListRows: 10,
      images: [],
    },
  });

  const { data: existing, isLoading: loadingRaffle } = useQuery({
    queryKey: ['raffle', id],
    queryFn: () => raffleService.get(id as string),
    enabled: isEdit,
  });

  useEffect(() => {
    if (!existing?.raffle) return;
    const r: RaffleDTO = existing.raffle;
    reset({
      title: r.title,
      description: r.description ?? '',
      prize: r.prize ?? '',
      ticketPrice: r.ticketPrice,
      totalTickets: r.totalTickets,
      ticketFormat: r.ticketFormat,
      ticketStart: r.ticketStart,
      opportunities: r.opportunities,
      maxTicketsPerOrder: r.maxTicketsPerOrder ?? undefined,
      terms: r.terms ?? '',
      paymentInstructions: r.paymentInstructions ?? '',
      reserveMinutes: r.reserveMinutes,
      allowWinnerPublication: r.allowWinnerPublication,
      useDigitalDraw: r.useDigitalDraw,
      showCountdown: r.showCountdown,
      priceListRows: r.priceListRows,
      images: r.images.map((img) => img.url),
    });
    setImages(r.images.map((img) => img.url));
    setDrawLocal(isoToLocal(r.drawDate));
  }, [existing, reset]);

  useEffect(() => {
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }, [step]);

  const ticketFormat = Number(watch('ticketFormat')) || 3;
  const ticketStart = Number(watch('ticketStart')) || 0;
  const totalTicketsW = Number(watch('totalTickets')) || 0;
  const opportunities = Number(watch('opportunities')) || 1;

  // Resumen de emisiones y rangos manual/regalo (explicación dinámica del campo).
  const emissions = totalEmissions(totalTicketsW, opportunities);
  const giftRange = giftTicketRange(ticketStart, totalTicketsW, opportunities);
  const manualRangeText =
    totalTicketsW > 0
      ? `${formatTicketNumber(ticketStart, ticketFormat)} - ${formatTicketNumber(ticketStart + totalTicketsW - 1, ticketFormat)}`
      : '—';
  const giftRangeText = giftRange
    ? `${formatTicketNumber(giftRange.start, ticketFormat)} - ${formatTicketNumber(giftRange.end, ticketFormat)}`
    : null;
  // Si la rifa ya tiene boletos comprometidos, no se puede cambiar oportunidades.
  const raffleHasOrders = isEdit && !!existing?.raffle && existing.raffle.soldCount + existing.raffle.reservedCount > 0;

  const save = useMutation({
    mutationFn: (input: CreateRaffleInput) =>
      isEdit ? raffleService.update(id as string, input) : raffleService.create(input),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['raffles'] });
      if (isEdit) {
        toast.success('Rifa actualizada');
        void queryClient.invalidateQueries({ queryKey: ['raffle', id] });
        navigate('/admin/rifas');
        return;
      }
      // Al crear: pantalla de éxito con el siguiente paso claro (publicar).
      setCreated(res.raffle);
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo guardar la rifa');
    },
  });

  const publishNow = useMutation({
    mutationFn: (raffleId: string) => raffleService.publish(raffleId),
    onSuccess: (res) => {
      toast.success('¡Publicada! Tu rifa ya está visible para tus compradores.');
      setCreated(res.raffle);
      void queryClient.invalidateQueries({ queryKey: ['raffles'] });
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 402) {
        toast.error(e.message, { description: 'Activa un plan para publicar tus rifas.' });
        return;
      }
      toast.error(e instanceof ApiError ? e.message : 'No se pudo publicar la rifa');
    },
  });

  const shareCreated = () => {
    if (!created || !slug) return;
    const url = buildRaffleShareUrl(slug, created.eventNumber);
    if (navigator.share) {
      void navigator.share({ title: created.title, text: `Participa en mi rifa "${created.title}": ${url}`, url }).catch(() => {});
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success('Link copiado. ¡Compártelo!'))
      .catch(() => toast.error('No se pudo copiar el link'));
  };

  const onSubmit = handleSubmit((values) => {
    // La fecha del sorteo es obligatoria: de ella depende la cuenta regresiva.
    if (!drawLocal) {
      setDrawError('Indica la fecha y hora del sorteo.');
      setStep(STEPS.length - 1);
      return;
    }
    save.mutate({
      ...values,
      drawDate: localToIso(drawLocal),
      images,
    });
  });

  const next = async () => {
    const ok = await trigger(STEP_FIELDS[step]);
    if (ok) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    } else {
      toast.error('Revisa los campos marcados en rojo para continuar.');
    }
  };
  const back = () => {
    if (step === 0) navigate('/admin/rifas');
    else setStep((s) => s - 1);
  };

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      toast.error(`Máximo ${MAX_IMAGES} imágenes.`);
      return;
    }
    const queue = Array.from(files).slice(0, remaining);
    setUploadProgress({ done: 0, total: queue.length });
    try {
      const urls: string[] = [];
      for (const [i, file] of queue.entries()) {
        const res = await uploadService.image(file, 'prizes');
        urls.push(res.url);
        setUploadProgress({ done: i + 1, total: queue.length });
      }
      const nextImgs = [...images, ...urls];
      setImages(nextImgs);
      setValue('images', nextImgs, { shouldValidate: true });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudieron subir las imágenes. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setUploadProgress(null);
    }
  }
  function removeImage(url: string) {
    const nextImgs = images.filter((u) => u !== url);
    setImages(nextImgs);
    setValue('images', nextImgs, { shouldValidate: true });
  }

  if (isEdit && loadingRaffle) return <PageLoader label="Cargando rifa..." />;

  // ── Pantalla de éxito tras crear: conecta crear → publicar → compartir ──
  if (created) {
    const isLive = created.status === 'PUBLISHED';
    const publicUrl = slug ? buildRaffleUrl(slug, created.eventNumber) : null;
    return (
      <div className="mx-auto max-w-xl">
        <FormSection
          title={isLive ? '¡Tu rifa está publicada! 🎉' : '¡Tu rifa está lista!'}
          description={
            isLive
              ? 'Ya es visible para tus compradores. Compártela para empezar a vender.'
              : 'Se guardó como borrador. Publícala cuando quieras que tus compradores la vean.'
          }
        >
          <div className="rounded-xl border bg-muted/40 px-4 py-3">
            <p className="font-ticket text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {created.eventLabel}
            </p>
            <p className="font-display text-lg font-extrabold leading-tight">{created.title}</p>
          </div>

          <div className="space-y-2.5">
            {!isLive && (
              <Button
                variant="brand"
                size="lg"
                className="w-full rounded-xl"
                loading={publishNow.isPending}
                onClick={() => publishNow.mutate(created.id)}
              >
                Publicar ahora
              </Button>
            )}
            {isLive && (
              <Button variant="brand" size="lg" className="w-full rounded-xl" onClick={shareCreated}>
                Compartir mi rifa
              </Button>
            )}
            {publicUrl && isLive && (
              <Button asChild variant="outline" size="lg" className="w-full rounded-xl">
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  Ver cómo se ve
                </a>
              </Button>
            )}
            <Button variant="ghost" size="lg" className="w-full rounded-xl" onClick={() => navigate('/admin/rifas')}>
              Ir a mis rifas
            </Button>
          </div>
        </FormSection>
      </div>
    );
  }

  const exampleTicket = formatTicketNumber(ticketStart, ticketFormat);
  const progress = ((step + 1) / STEPS.length) * 100;

  return (
    <div ref={topRef} className="mx-auto max-w-xl">
      {/* Progreso del asistente (el título de pantalla ya está en el header del
          panel y el del paso lo pone la tarjeta de abajo). */}
      <div className="mb-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress}%` }} />
        </div>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">
          Paso {step + 1} de {STEPS.length}
        </span>
      </div>

      <form
        onSubmit={onSubmit}
        // El guardado es MANUAL: solo el botón "Guardar cambios" envía el
        // formulario. Sin esto, presionar Enter en un campo (p. ej. la fecha del
        // sorteo) lo enviaba de inmediato y sacaba al usuario antes de terminar.
        // Se permite Enter dentro de <textarea> para que siga creando saltos de línea.
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
            e.preventDefault();
          }
        }}
      >
        <FormSection title={STEPS[step].title} description={STEPS[step].desc}>
          {/* Paso 1: Tu rifa */}
          {step === 0 && (
            <>
              <Field label="Título de la rifa" htmlFor="title" error={errors.title?.message}>
                <Input id="title" placeholder="Ej. Gran rifa de la camioneta" {...register('title')} />
              </Field>
              <Field label="Premio" htmlFor="prize" error={errors.prize?.message}>
                <Input id="prize" placeholder="Ej. Camioneta 2024 0 km" {...register('prize')} />
              </Field>
              <Field
                label="Descripción"
                htmlFor="description"
                hint="Aparece como cartel arriba de los boletos. Dale formato: negritas, colores, tamaño y alineación para premios, lugares y bonos."
                error={errors.description?.message}
              >
                <RichTextEditor
                  value={watch('description') ?? ''}
                  onChange={(html) => setValue('description', html, { shouldValidate: true })}
                  placeholder="Con tu boleto pagado participas por:  2º LUGAR $5,000 MXN…"
                />
              </Field>
            </>
          )}

          {/* Paso 2: Boletos y precio */}
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Precio por boleto (MXN)" htmlFor="ticketPrice" error={errors.ticketPrice?.message}>
                  <Input id="ticketPrice" type="number" inputMode="numeric" min={1} {...register('ticketPrice', { valueAsNumber: true })} />
                </Field>
                <Field
                  label="Total de boletos"
                  htmlFor="totalTickets"
                  hint={isEdit ? 'No se puede cambiar después de crear la rifa.' : undefined}
                  error={errors.totalTickets?.message}
                >
                  <Input id="totalTickets" type="number" inputMode="numeric" min={1} disabled={isEdit} {...register('totalTickets', { valueAsNumber: true })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Formato del número" htmlFor="ticketFormat" error={errors.ticketFormat?.message}>
                  <Select id="ticketFormat" disabled={isEdit} {...register('ticketFormat', { valueAsNumber: true })}>
                    <option value={3}>3 dígitos (001)</option>
                    <option value={4}>4 dígitos (0001)</option>
                    <option value={5}>5 dígitos (00001)</option>
                  </Select>
                </Field>
                <Field label="Empieza en el número" htmlFor="ticketStart" error={errors.ticketStart?.message}>
                  <Input id="ticketStart" type="number" inputMode="numeric" min={0} disabled={isEdit} {...register('ticketStart', { valueAsNumber: true })} />
                </Field>
              </div>
              <Field
                label="Máximo de boletos por compra"
                htmlFor="maxTicketsPerOrder"
                hint="Opcional. Déjalo vacío para no poner límite."
                error={errors.maxTicketsPerOrder?.message}
              >
                <Input
                  id="maxTicketsPerOrder"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="Sin límite"
                  {...register('maxTicketsPerOrder', { setValueAs: (v) => (v === '' || v === null ? undefined : Number(v)) })}
                />
              </Field>
              <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm">
                <span className="text-muted-foreground">Así se verá un boleto: </span>
                <span className="font-mono font-bold tabular-nums">{exampleTicket}</span>
              </div>

              {/* Oportunidades por boleto */}
              <Field
                label="Oportunidades por boleto"
                htmlFor="opportunities"
                hint={
                  raffleHasOrders
                    ? 'No se puede cambiar: esta rifa ya tiene órdenes generadas.'
                    : isEdit
                      ? 'No se puede cambiar después de crear la rifa.'
                      : 'Define cuántos números participan por cada boleto seleccionado. Si configuras 3, el cliente elige 1 boleto y el sistema le asigna 2 números de regalo automáticamente.'
                }
                error={errors.opportunities?.message}
              >
                <Input
                  id="opportunities"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={50}
                  disabled={isEdit}
                  {...register('opportunities', { valueAsNumber: true })}
                />
              </Field>

              {/* Explicación dinámica de emisiones y rangos */}
              <div
                className={cn(
                  'rounded-xl border px-4 py-3 text-sm',
                  opportunities > 1
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border bg-muted/40 text-muted-foreground',
                )}
              >
                {opportunities > 1 ? (
                  <>
                    <p className="font-medium text-foreground">
                      Esta rifa tendrá{' '}
                      <strong>{totalTicketsW.toLocaleString('es-MX')}</strong> boletos seleccionables y{' '}
                      <strong>{emissions.toLocaleString('es-MX')}</strong> emisiones totales. Cada boleto comprado
                      generará{' '}
                      <strong>
                        {opportunities - 1} número{opportunities - 1 === 1 ? '' : 's'}
                      </strong>{' '}
                      de regalo.
                    </p>
                    <div className="mt-2 grid gap-1 font-mono text-xs">
                      <span>
                        <span className="text-muted-foreground">Rango manual:</span>{' '}
                        <strong>{manualRangeText}</strong>
                      </span>
                      <span>
                        <span className="text-muted-foreground">Rango de regalo:</span>{' '}
                        <strong>{giftRangeText}</strong>
                      </span>
                    </div>
                  </>
                ) : (
                  <span>Con 1 oportunidad no hay números de regalo: funciona como una rifa normal.</span>
                )}
              </div>
            </>
          )}

          {/* Paso 3: Imágenes */}
          {step === 2 && (
            <>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {images.map((url) => (
                  <div key={url} className="relative aspect-square overflow-hidden rounded-xl border bg-muted">
                    <img src={apiAssetUrl(url)} alt="Premio" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(url)}
                      aria-label="Quitar imagen"
                      className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-lg leading-none text-white transition-colors active:bg-black/80"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {images.length < MAX_IMAGES && (
                  <label
                    className={cn(
                      'grid aspect-square cursor-pointer place-items-center rounded-xl border border-dashed px-1 text-center text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent active:bg-accent',
                      uploading && 'pointer-events-none opacity-60',
                    )}
                  >
                    {uploadProgress ? `Subiendo ${Math.min(uploadProgress.done + 1, uploadProgress.total)} de ${uploadProgress.total}…` : 'Agregar foto'}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        void handleFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
              {errors.images && <p className="mt-2 text-sm text-destructive">{errors.images.message}</p>}
              <p className="text-xs text-muted-foreground">Puedes continuar sin fotos y agregarlas después.</p>
            </>
          )}

          {/* Paso 4: Sorteo y pago */}
          {step === 3 && (
            <>
              <Field
                label="Fecha y hora del sorteo"
                htmlFor="drawDate"
                hint="Obligatoria. Con esta fecha se arma la cuenta regresiva que ven tus compradores."
                error={drawError}
              >
                <Input
                  id="drawDate"
                  type="datetime-local"
                  value={drawLocal}
                  onChange={(e) => {
                    setDrawLocal(e.target.value);
                    setDrawError(undefined);
                  }}
                />
              </Field>
              {/* Mostrar/ocultar la cuenta regresiva al sorteo en la rifa pública. */}
              <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Mostrar cuenta regresiva</p>
                  <p className="text-xs text-muted-foreground">
                    Un contador de días, horas y minutos hasta el sorteo, visible para tus compradores.
                  </p>
                </div>
                <Switch
                  checked={watch('showCountdown') ?? true}
                  onCheckedChange={(v) => setValue('showCountdown', v)}
                />
              </div>
              <Field
                label="Filas de la tabla de precios"
                htmlFor="priceListRows"
                hint='La lista "N boletos por $X" llega hasta esta cantidad de boletos. Por defecto 10.'
                error={errors.priceListRows?.message}
              >
                <Input
                  id="priceListRows"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={50}
                  {...register('priceListRows', { valueAsNumber: true })}
                />
              </Field>
              <Field
                label="Términos y condiciones"
                htmlFor="terms"
                hint="Aparecen al final de la rifa. Opcional."
                error={errors.terms?.message}
              >
                <Textarea id="terms" rows={3} placeholder="Reglas de la rifa, requisitos del ganador, etc." {...register('terms')} />
              </Field>
              <Field
                label="Instrucciones de pago"
                htmlFor="paymentInstructions"
                hint="Opcional. Si lo dejas vacío, se muestran tus Datos de pago (Más → Datos de pago)."
                error={errors.paymentInstructions?.message}
              >
                <Textarea id="paymentInstructions" rows={3} placeholder="Transferencia, depósito, datos de la cuenta…" {...register('paymentInstructions')} />
              </Field>
            </>
          )}
        </FormSection>

        {/* Navegación del asistente: sticky para que Siguiente/Guardar siempre
            estén a la mano (en móvil, sin perseguirlos con el scroll). */}
        <div className="sticky bottom-0 z-10 -mx-4 -mb-[max(1.25rem,env(safe-area-inset-bottom))] mt-4 flex items-center gap-3 border-t bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-5 sm:px-5">
          <Button type="button" variant="ghost" size="lg" onClick={back}>
            {step === 0 ? 'Cancelar' : 'Atrás'}
          </Button>
          <div className="flex-1" />
          {step < STEPS.length - 1 ? (
            <Button type="button" variant="brand" size="lg" className="min-w-[40%]" onClick={() => void next()}>
              Siguiente
            </Button>
          ) : (
            <Button type="submit" variant="brand" size="lg" className="min-w-[40%]" loading={save.isPending} disabled={uploading}>
              {isEdit ? 'Guardar cambios' : 'Crear rifa'}
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
