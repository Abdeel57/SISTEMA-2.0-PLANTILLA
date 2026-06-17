import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, Layers, Package, Plus, Trash2 } from 'lucide-react';
import { computeOrderPrice, formatMXN } from '@bismark/shared';
import { raffleService } from '@/services/raffles';
import { ApiError } from '@/lib/api';
import { PanelIntro } from '@/components/owner/PanelKit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PageLoader, EmptyState } from '@/components/ui/misc';
import { PromoBanner } from '@/components/public/PromoBanner';
import { toast } from 'sonner';

// Filas de edición (texto en los inputs; se convierten a número al guardar).
type TierRow = { minQty: string; unitPrice: string };
type BundleRow = { qty: string; price: string };

const toInt = (s: string): number => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : NaN;
};

// Colores por defecto de la tira (mismo degradado que usa PromoBanner si la
// rifa no tiene colores guardados).
const DEFAULT_FROM = '#f97316';
const DEFAULT_TO = '#dc2626';

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 w-14 shrink-0 cursor-pointer rounded-xl border border-input bg-background p-1"
        />
        <span className="text-sm font-medium uppercase text-muted-foreground">{value}</span>
      </div>
    </div>
  );
}

// Configura el anuncio/promoción de UNA rifa: la tira a todo lo ancho que los
// compradores ven bajo el encabezado de la rifa pública.
export default function RafflePromo() {
  const { id } = useParams<{ id: string }>();
  const raffleId = id as string;
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['raffle', raffleId],
    queryFn: () => raffleService.get(raffleId),
  });
  const raffle = data?.raffle;

  const [enabled, setEnabled] = useState(false);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [colorFrom, setColorFrom] = useState(DEFAULT_FROM);
  const [colorTo, setColorTo] = useState(DEFAULT_TO);
  // Promociones de volumen.
  const [tiers, setTiers] = useState<TierRow[]>([]);
  const [bundles, setBundles] = useState<BundleRow[]>([]);

  // Prellenar con lo guardado cuando llega la rifa.
  useEffect(() => {
    if (!raffle) return;
    setEnabled(raffle.promoEnabled);
    setTitle(raffle.promoTitle ?? '');
    setSubtitle(raffle.promoSubtitle ?? '');
    setColorFrom(raffle.promoColorFrom ?? DEFAULT_FROM);
    setColorTo(raffle.promoColorTo ?? DEFAULT_TO);
    setTiers(raffle.pricingTiers.map((t) => ({ minQty: String(t.minQty), unitPrice: String(t.unitPrice) })));
    setBundles(raffle.pricingBundles.map((b) => ({ qty: String(b.qty), price: String(b.price) })));
  }, [raffle]);

  // Sólo filas completas y válidas se guardan/usan en la vista previa.
  const cleanTiers = useMemo(
    () =>
      tiers
        .map((t) => ({ minQty: toInt(t.minQty), unitPrice: toInt(t.unitPrice) }))
        .filter((t) => t.minQty >= 2 && t.unitPrice >= 0),
    [tiers],
  );
  const cleanBundles = useMemo(
    () =>
      bundles
        .map((b) => ({ qty: toInt(b.qty), price: toInt(b.price) }))
        .filter((b) => b.qty >= 2 && b.price >= 0),
    [bundles],
  );

  // Cantidades de muestra para la vista previa de precios (incluye las de las ofertas).
  const sampleQtys = useMemo(() => {
    const set = new Set<number>([1, 2, 3, 5, 10]);
    cleanBundles.forEach((b) => set.add(b.qty));
    cleanTiers.forEach((t) => set.add(t.minQty));
    return [...set].filter((n) => n > 0).sort((a, b) => a - b).slice(0, 8);
  }, [cleanTiers, cleanBundles]);

  const save = useMutation({
    mutationFn: () =>
      raffleService.update(raffleId, {
        promoEnabled: enabled,
        promoTitle: title.trim(),
        promoSubtitle: subtitle.trim(),
        promoColorFrom: colorFrom,
        promoColorTo: colorTo,
        pricingTiers: cleanTiers,
        pricingBundles: cleanBundles,
      }),
    onSuccess: () => {
      if (!enabled && title.trim()) {
        toast.warning('Promoción guardada, pero está oculta. Activa "Mostrar promoción" para que aparezca en tu rifa.');
      } else {
        toast.success('Promoción guardada.');
      }
      void queryClient.invalidateQueries({ queryKey: ['raffle', raffleId] });
      void queryClient.invalidateQueries({ queryKey: ['raffles'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo guardar la promoción'),
  });

  const onSave = () => {
    if (enabled && !title.trim()) {
      toast.error('Escribe el texto de tu promoción para poder mostrarla.');
      return;
    }
    save.mutate();
  };

  if (isLoading) return <PageLoader label="Cargando la rifa..." />;
  if (isError || !raffle) {
    return <EmptyState title="No pudimos cargar la rifa" description="Regresa a tus rifas e intenta de nuevo." />;
  }

  return (
    <div>
      <PanelIntro description={`Anuncios, avisos y promociones de "${raffle.title}" (${raffle.eventLabel}).`} />

      {/* Activar/desactivar */}
      <Card>
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Megaphone className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold">Mostrar promoción</p>
              <p className="text-xs text-muted-foreground">
                Aparece como una tira a todo lo ancho bajo el encabezado de tu rifa.
              </p>
              {!enabled && title.trim() && (
                <p className="mt-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Tu promoción está escrita pero oculta: activa este interruptor para mostrarla.
                </p>
              )}
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </CardContent>
      </Card>

      {/* Contenido y colores */}
      <Card className="mt-3">
        <CardHeader>
          <CardTitle>Personaliza tu promoción</CardTitle>
          <CardDescription>Escribe tu anuncio y elige los colores de la tira.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div>
            <Label htmlFor="promo-title">Texto principal</Label>
            <Input
              id="promo-title"
              value={title}
              maxLength={80}
              placeholder="🔥 ¡PROMOCIÓN 3X2!"
              onChange={(e) => {
                const v = e.target.value;
                // Escribir el anuncio implica querer mostrarlo: enciende el
                // interruptor solo (evita guardar una promoción invisible).
                if (!enabled && v.trim() && !title.trim()) setEnabled(true);
                setTitle(v);
              }}
            />
          </div>
          <div>
            <Label htmlFor="promo-subtitle">Aviso (opcional)</Label>
            <Input
              id="promo-subtitle"
              value={subtitle}
              maxLength={140}
              placeholder="Disponible hasta el viernes 1 de mayo."
              onChange={(e) => setSubtitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ColorField label="Color inicial" value={colorFrom} onChange={setColorFrom} />
            <ColorField label="Color final" value={colorTo} onChange={setColorTo} />
          </div>
          <button
            type="button"
            className="justify-self-start text-xs font-semibold text-muted-foreground underline hover:text-foreground"
            onClick={() => {
              setColorFrom(DEFAULT_FROM);
              setColorTo(DEFAULT_TO);
            }}
          >
            Restaurar colores originales
          </button>
        </CardContent>
      </Card>

      {/* Vista previa en vivo */}
      <Card className="mt-3 overflow-hidden">
        <CardHeader>
          <CardTitle>Vista previa</CardTitle>
          <CardDescription>Así la verán tus compradores en la página de la rifa.</CardDescription>
        </CardHeader>
        {title.trim() ? (
          <PromoBanner title={title.trim()} subtitle={subtitle.trim() || null} colorFrom={colorFrom} colorTo={colorTo} />
        ) : (
          <p className="px-6 pb-5 text-sm text-muted-foreground">Escribe el texto principal para ver tu promoción.</p>
        )}
        {title.trim() && <div className="pb-4" />}
      </Card>

      {/* ── Niveles por cantidad ── */}
      <Card className="mt-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" /> Precios por cantidad
          </CardTitle>
          <CardDescription>
            A partir de cierta cantidad, cada boleto baja de precio y el nuevo precio aplica a <strong>todo</strong> el
            pedido. Ej.: a partir de 30 boletos, cada boleto $5 (30 × $5 = $150).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {tiers.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin niveles. Agrega uno para premiar las compras grandes.</p>
          )}
          {tiers.map((t, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Label>A partir de (boletos)</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={2}
                  placeholder="30"
                  value={t.minQty}
                  onChange={(e) =>
                    setTiers((rows) => rows.map((r, j) => (j === i ? { ...r, minQty: e.target.value } : r)))
                  }
                />
              </div>
              <div className="flex-1">
                <Label>Precio por boleto</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="5"
                  value={t.unitPrice}
                  onChange={(e) =>
                    setTiers((rows) => rows.map((r, j) => (j === i ? { ...r, unitPrice: e.target.value } : r)))
                  }
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Quitar nivel"
                onClick={() => setTiers((rows) => rows.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => setTiers((rows) => [...rows, { minQty: '', unitPrice: '' }])}
          >
            <Plus className="h-4 w-4" /> Agregar nivel
          </Button>
        </CardContent>
      </Card>

      {/* ── Paquetes de cantidad exacta ── */}
      <Card className="mt-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" /> Paquetes
          </CardTitle>
          <CardDescription>
            Una cantidad exacta por un precio total. Ej.: 3 boletos por $25. Se combinan automáticamente si conviene
            (6 boletos = dos paquetes de 3).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {bundles.length === 0 && (
            <p className="text-sm text-muted-foreground">Sin paquetes. Agrega uno como "3 boletos por $25".</p>
          )}
          {bundles.map((b, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1">
                <Label>Boletos</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={2}
                  placeholder="3"
                  value={b.qty}
                  onChange={(e) =>
                    setBundles((rows) => rows.map((r, j) => (j === i ? { ...r, qty: e.target.value } : r)))
                  }
                />
              </div>
              <div className="flex-1">
                <Label>Precio del paquete</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  placeholder="25"
                  value={b.price}
                  onChange={(e) =>
                    setBundles((rows) => rows.map((r, j) => (j === i ? { ...r, price: e.target.value } : r)))
                  }
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Quitar paquete"
                onClick={() => setBundles((rows) => rows.filter((_, j) => j !== i))}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => setBundles((rows) => [...rows, { qty: '', price: '' }])}
          >
            <Plus className="h-4 w-4" /> Agregar paquete
          </Button>
        </CardContent>
      </Card>

      {/* ── Vista previa de precios (lo que pagará el comprador) ── */}
      {(cleanTiers.length > 0 || cleanBundles.length > 0) && (
        <Card className="mt-3">
          <CardHeader>
            <CardTitle>Vista previa de precios</CardTitle>
            <CardDescription>El comprador siempre paga el total más barato posible.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y rounded-xl border">
              {sampleQtys.map((n) => {
                const r = computeOrderPrice(n, {
                  basePrice: raffle.ticketPrice,
                  tiers: cleanTiers,
                  bundles: cleanBundles,
                });
                return (
                  <div key={n} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="font-semibold">
                      {n} {n === 1 ? 'boleto' : 'boletos'}
                    </span>
                    <span className="flex items-center gap-2">
                      {r.savings > 0 && (
                        <span className="text-xs text-muted-foreground line-through">{formatMXN(r.baseTotal)}</span>
                      )}
                      <span className="font-bold tabular-nums">{formatMXN(r.total)}</span>
                      <span className="text-xs text-muted-foreground">({formatMXN(Math.round(r.unitEffective))} c/u)</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Button variant="brand" className="mt-4 w-full" loading={save.isPending} onClick={onSave}>
        Guardar promoción
      </Button>
    </div>
  );
}
