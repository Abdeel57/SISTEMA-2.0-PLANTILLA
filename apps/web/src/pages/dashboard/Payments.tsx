import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Info, Lock, Plus, Trash2 } from 'lucide-react';
import { paymentMethodSchema, type PaymentMethodInput } from '@bismark/shared';
import { riferoService } from '@/services/riferos';
import { ApiError } from '@/lib/api';
import { PanelIntro } from '@/components/owner/PanelKit';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { PageLoader } from '@/components/ui/misc';
import { BankCard } from '@/components/public/BankCard';
import { BANKS } from '@/lib/banks';
import { toast } from 'sonner';

const MAX_METHODS = 6;

const emptyMethod = (): PaymentMethodInput => ({
  id: (crypto.randomUUID?.() ?? `m${Date.now()}`).slice(0, 13),
  bank: '',
  holderName: '',
  clabe: '',
  cardNumber: '',
  concept: '',
  instructions: '',
});

// Editor de UN método: inputs + vista previa en vivo de la tarjeta del banco.
function MethodEditor({
  method,
  index,
  onChange,
  onRemove,
}: {
  method: PaymentMethodInput;
  index: number;
  onChange: (m: PaymentMethodInput) => void;
  onRemove: () => void;
}) {
  const set = (k: keyof PaymentMethodInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange({ ...method, [k]: e.target.value });

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-ticket text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Método {String(index + 1).padStart(2, '0')}
          </p>
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-destructive transition-colors hover:bg-destructive/10"
          >
            <Trash2 className="h-3.5 w-3.5" /> Quitar
          </button>
        </div>

        {/* Vista previa en vivo */}
        <div className="mx-auto mb-5 max-w-sm">
          <BankCard
            method={{
              ...method,
              bank: method.bank || 'Tu banco',
              holderName: method.holderName || 'NOMBRE DEL TITULAR',
              instructions: null, // las instrucciones van abajo, no en la preview
            }}
          />
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <div>
            <Label htmlFor={`bank-${method.id}`}>Banco o método</Label>
            <Input
              id={`bank-${method.id}`}
              placeholder="BBVA, Banorte, OXXO, Nu…"
              list="sortea-banks"
              value={method.bank}
              onChange={set('bank')}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              La tarjeta toma los colores del banco automáticamente.
            </p>
          </div>
          <div>
            <Label htmlFor={`holder-${method.id}`}>Titular de la cuenta</Label>
            <Input id={`holder-${method.id}`} placeholder="José Pérez García" value={method.holderName ?? ''} onChange={set('holderName')} />
          </div>
          <div>
            <Label htmlFor={`clabe-${method.id}`}>CLABE interbancaria</Label>
            <Input id={`clabe-${method.id}`} inputMode="numeric" placeholder="18 dígitos" value={method.clabe ?? ''} onChange={set('clabe')} />
          </div>
          <div>
            <Label htmlFor={`card-${method.id}`}>Número de tarjeta</Label>
            <Input id={`card-${method.id}`} inputMode="numeric" placeholder="16 dígitos" value={method.cardNumber ?? ''} onChange={set('cardNumber')} />
          </div>
          <div>
            <Label htmlFor={`concept-${method.id}`}>Concepto / referencia</Label>
            <Input id={`concept-${method.id}`} placeholder="Ej. Rifa + tu folio" value={method.concept ?? ''} onChange={set('concept')} />
          </div>
          <div>
            <Label htmlFor={`instr-${method.id}`}>Nota de este método (opcional)</Label>
            <Input
              id={`instr-${method.id}`}
              placeholder="Ej. Solo depósitos en efectivo"
              value={method.instructions ?? ''}
              onChange={set('instructions')}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Payments() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['rifero', 'me'],
    queryFn: () => riferoService.me(),
  });
  const profile = data?.profile;
  const planAllowsProof = profile?.activePlan?.allowProofUpload ?? false;

  const [methods, setMethods] = useState<PaymentMethodInput[]>([]);
  const [payWhatsapp, setPayWhatsapp] = useState('');
  const [payInstructions, setPayInstructions] = useState('');
  const [allowProofUpload, setAllowProofUpload] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!profile || loaded) return;
    // paymentMethods ya viene con el fallback legado sintetizado por el backend.
    setMethods(
      (profile.paymentMethods ?? []).map((m) => ({
        id: m.id === 'legacy' ? emptyMethod().id : m.id,
        bank: m.bank ?? '',
        holderName: m.holderName ?? '',
        clabe: m.clabe ?? '',
        cardNumber: m.cardNumber ?? '',
        concept: m.concept ?? '',
        instructions: m.instructions ?? '',
      })),
    );
    setPayWhatsapp(profile.payWhatsapp ?? '');
    setPayInstructions(profile.payInstructions ?? '');
    setAllowProofUpload(planAllowsProof ? profile.allowProofUpload : false);
    setLoaded(true);
  }, [profile, planAllowsProof, loaded]);

  const touch = () => setDirty(true);

  const mutation = useMutation({
    mutationFn: () => {
      const first = methods[0];
      return riferoService.update({
        paymentMethods: methods,
        payWhatsapp,
        payInstructions,
        ...(planAllowsProof ? { allowProofUpload } : {}),
        // Espejo del primer método en los campos legados (compatibilidad).
        payBank: first?.bank ?? '',
        payHolderName: first?.holderName ?? '',
        payClabe: first?.clabe ?? '',
        payCardNumber: first?.cardNumber ?? '',
        payConcept: first?.concept ?? '',
      });
    },
    onSuccess: (res) => {
      toast.success('Datos de pago guardados');
      queryClient.setQueryData(['rifero', 'me'], res);
      void queryClient.invalidateQueries({ queryKey: ['rifero', 'me'] });
      setDirty(false);
    },
    onError: (e) => {
      toast.error(e instanceof ApiError ? e.message : 'Algo salió mal');
    },
  });

  const save = () => {
    for (let i = 0; i < methods.length; i++) {
      const r = paymentMethodSchema.safeParse(methods[i]);
      if (!r.success) {
        toast.error(`Método ${i + 1}: ${r.error.issues[0]?.message ?? 'datos inválidos'}`);
        return;
      }
    }
    mutation.mutate();
  };

  if (isLoading) return <PageLoader label="Cargando tus datos de pago..." />;

  return (
    <div>
      <PanelIntro description="Configura cómo te van a pagar tus compradores." />

      {/* Sugerencias de bancos para el autocompletado */}
      <datalist id="sortea-banks">
        {BANKS.map((b) => (
          <option key={b.id} value={b.name} />
        ))}
      </datalist>

      <Card className="mb-5 border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40">
        <CardContent className="flex gap-3 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="text-sm">
            <p className="font-semibold text-blue-900 dark:text-blue-200">El pago es directo a ti</p>
            <p className="text-blue-800/90 dark:text-blue-300/90">
              El comprador te paga directamente con estos datos. Sortea no cobra ni procesa el dinero en esta
              versión: tú recibes el pago y confirmas la orden.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Métodos de pago (tarjetas) ── */}
      <div className="mb-5 space-y-4">
        {methods.map((m, i) => (
          <MethodEditor
            key={m.id}
            method={m}
            index={i}
            onChange={(next) => {
              setMethods((arr) => arr.map((x) => (x.id === m.id ? next : x)));
              touch();
            }}
            onRemove={() => {
              setMethods((arr) => arr.filter((x) => x.id !== m.id));
              touch();
            }}
          />
        ))}

        {methods.length < MAX_METHODS && (
          <button
            type="button"
            onClick={() => {
              setMethods((arr) => [...arr, emptyMethod()]);
              touch();
            }}
            className="grid w-full place-items-center gap-1 rounded-2xl border-2 border-dashed px-4 py-6 text-sm font-semibold text-muted-foreground transition-colors hover:border-brand/50 hover:text-brand"
          >
            <Plus className="h-5 w-5" />
            {methods.length === 0 ? 'Agregar mi primer método de pago' : 'Agregar otro método (banco, OXXO, etc.)'}
          </button>
        )}
      </div>

      {/* ── Generales ── */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Para todos los métodos</CardTitle>
          <CardDescription>Estos datos aplican sin importar a qué cuenta te paguen.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="payWhatsapp">WhatsApp para enviar comprobantes</Label>
            <Input
              id="payWhatsapp"
              inputMode="tel"
              placeholder="55 1234 5678"
              value={payWhatsapp}
              onChange={(e) => {
                setPayWhatsapp(e.target.value);
                touch();
              }}
            />
          </div>
          <div>
            <Label htmlFor="payInstructions">Instrucciones generales de pago</Label>
            <Textarea
              id="payInstructions"
              rows={3}
              placeholder="Ej. Realiza tu transferencia y envíame el comprobante por WhatsApp para confirmar tus boletos."
              value={payInstructions}
              onChange={(e) => {
                setPayInstructions(e.target.value);
                touch();
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Comprobantes en la plataforma */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle>Comprobantes en la plataforma</CardTitle>
          <CardDescription>Permite que el comprador suba su comprobante de pago directo en su orden.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Subir comprobante en su orden</p>
              <p className="text-xs text-muted-foreground">
                {planAllowsProof
                  ? 'Si lo activas, el comprador podrá adjuntar la foto de su pago.'
                  : 'Tu plan actual no incluye esta función.'}
              </p>
            </div>
            <Switch
              checked={allowProofUpload}
              onCheckedChange={(v) => {
                setAllowProofUpload(v);
                touch();
              }}
              disabled={!planAllowsProof}
              aria-label="Permitir subir comprobante"
            />
          </div>
          {!planAllowsProof && (
            <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              Mejora tu plan para que tus compradores suban su comprobante en la plataforma.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Barra de guardar sticky, pegada al fondo del área de scroll del panel. */}
      <div className="sticky bottom-0 z-10 -mx-4 -mb-[max(1.25rem,env(safe-area-inset-bottom))] border-t bg-background/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-5 sm:px-5">
        {dirty && (
          <p className="mb-2 text-center text-xs font-semibold text-amber-600 dark:text-amber-400">
            Tienes cambios sin guardar
          </p>
        )}
        <Button
          type="button"
          size="lg"
          variant="brand"
          className="w-full"
          loading={mutation.isPending}
          disabled={!dirty || mutation.isPending}
          onClick={save}
        >
          Guardar datos de pago
        </Button>
      </div>
    </div>
  );
}
