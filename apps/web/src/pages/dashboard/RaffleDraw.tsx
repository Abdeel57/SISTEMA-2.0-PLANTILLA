import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trophy, Plus, X, Play, Award, CheckCircle2, Info, Video, Upload, Trash2 } from 'lucide-react';
import {
  formatTicketNumber,
  type WinnerDTO,
  type DrawInput,
} from '@bismark/shared';
import { raffleService } from '@/services/raffles';
import { winnerService } from '@/services/winners';
import { uploadService } from '@/services/uploads';
import { ApiError, apiAssetUrl } from '@/lib/api';
import { PanelIntro } from '@/components/owner/PanelKit';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { PageLoader, EmptyState, Separator } from '@/components/ui/misc';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';

interface PrizeRow {
  position: number;
  prizeDescription: string;
}

function WinnerCard({ winner, raffleId }: { winner: WinnerDTO; raffleId: string }) {
  const queryClient = useQueryClient();
  const setPublished = useMutation({
    mutationFn: (published: boolean) => winnerService.setPublished(winner.id, published),
    onSuccess: (_data, published) => {
      toast.success(published ? 'Ganador publicado.' : 'Ganador oculto.');
      void queryClient.invalidateQueries({ queryKey: ['winners', raffleId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo actualizar'),
  });

  return (
    <Card className="overflow-hidden border-amber-200 dark:border-amber-900">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              <Award className="h-3.5 w-3.5" />
              Lugar #{winner.position}
            </span>
            <p className="mt-2 font-mono text-2xl font-extrabold tabular-nums">{winner.ticketDisplayNumber}</p>
            {winner.prizeDescription && (
              <p className="mt-0.5 text-sm text-muted-foreground">{winner.prizeDescription}</p>
            )}
            <p className="mt-2 text-sm font-semibold">{winner.buyer?.fullName ?? 'Sin comprador asignado'}</p>
            {winner.buyer?.phone && <p className="text-xs text-muted-foreground">{winner.buyer.phone}</p>}
          </div>
        </div>

        <Separator className="my-3" />

        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Publicar ganador</p>
            <p className="text-xs text-muted-foreground">Visible en tu página pública.</p>
          </div>
          <Switch
            checked={winner.published}
            disabled={setPublished.isPending}
            onCheckedChange={(v) => setPublished.mutate(v)}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Subir / mostrar el video del sorteo (se guarda en el volumen de Railway).
function DrawEvidence({ raffleId, currentUrl }: { raffleId: string; currentUrl: string | null }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const save = useMutation({
    mutationFn: (url: string) => winnerService.setEvidence(raffleId, url),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['winners', raffleId] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo guardar el video'),
  });

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('video/')) {
      toast.error('Selecciona un video (MP4, WEBM o MOV)');
      return;
    }
    setUploading(true);
    try {
      const { url } = await uploadService.video(file, 'evidence');
      await save.mutateAsync(url);
      toast.success('Video del sorteo guardado');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo subir el video');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Video className="h-5 w-5 text-primary" /> Video del sorteo
        </CardTitle>
        <CardDescription>Opcional. Sube la transmisión o evidencia para dar confianza a tus compradores.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {currentUrl && (
          <video src={apiAssetUrl(currentUrl)} controls playsInline className="w-full rounded-xl border bg-black" />
        )}
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" disabled={uploading} loading={uploading} onClick={() => inputRef.current?.click()}>
            <Upload className="h-4 w-4" />
            {currentUrl ? 'Cambiar video' : 'Subir video'}
          </Button>
          {currentUrl && (
            <Button type="button" variant="ghost" disabled={uploading || save.isPending} onClick={() => save.mutate('')}>
              <Trash2 className="h-4 w-4" />
              Quitar
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Máximo 50 MB · MP4, WEBM o MOV.</p>
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </CardContent>
    </Card>
  );
}

export default function RaffleDraw() {
  const { id } = useParams<{ id: string }>();
  const raffleId = id as string;
  const queryClient = useQueryClient();

  const [prizes, setPrizes] = useState<PrizeRow[]>([{ position: 1, prizeDescription: '' }]);
  const [allowRepeatWinner, setAllowRepeatWinner] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Tómbola
  const [spinning, setSpinning] = useState(false);
  const [spinValue, setSpinValue] = useState('');
  const spinRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pendingWinners, setPendingWinners] = useState<WinnerDTO[] | null>(null);

  const { data: raffleData, isLoading: loadingRaffle } = useQuery({
    queryKey: ['raffle', raffleId],
    queryFn: () => raffleService.get(raffleId),
  });

  const { data: winnersData, isLoading: loadingWinners } = useQuery({
    queryKey: ['winners', raffleId],
    queryFn: () => winnerService.list(raffleId),
  });

  const raffle = raffleData?.raffle;
  const existingWinners = winnersData?.items ?? [];
  const alreadyDrawn = existingWinners.length > 0;

  useEffect(() => {
    return () => {
      if (spinRef.current) clearInterval(spinRef.current);
    };
  }, []);

  function addPrize() {
    setPrizes((prev) => [...prev, { position: prev.length + 1, prizeDescription: '' }]);
  }

  function removePrize(index: number) {
    setPrizes((prev) => prev.filter((_, i) => i !== index).map((p, i) => ({ ...p, position: i + 1 })));
  }

  function updatePrize(index: number, value: string) {
    setPrizes((prev) => prev.map((p, i) => (i === index ? { ...p, prizeDescription: value } : p)));
  }

  function startTombola(winners: WinnerDTO[]) {
    const padding = raffle?.ticketFormat ?? 3;
    setSpinning(true);
    setPendingWinners(winners);
    spinRef.current = setInterval(() => {
      const max = raffle?.totalTickets ?? 999;
      const start = raffle?.ticketStart ?? 0;
      const rnd = start + Math.floor(Math.random() * Math.max(1, max));
      setSpinValue(formatTicketNumber(rnd, padding));
    }, 60);

    setTimeout(() => {
      if (spinRef.current) clearInterval(spinRef.current);
      spinRef.current = null;
      // Mostrar el número del primer ganador como cierre dramático.
      setSpinValue(winners[0]?.ticketDisplayNumber ?? '');
      setTimeout(() => {
        setSpinning(false);
        setPendingWinners(null);
        void queryClient.invalidateQueries({ queryKey: ['winners', raffleId] });
      }, 700);
    }, 2200);
  }

  const draw = useMutation({
    mutationFn: (input: DrawInput) => winnerService.draw(raffleId, input),
    onSuccess: (res) => {
      setConfirmOpen(false);
      toast.success('¡Sorteo realizado!');
      startTombola(res.winners);
    },
    onError: (e) => {
      setConfirmOpen(false);
      toast.error(e instanceof ApiError ? e.message : 'No se pudo realizar el sorteo');
    },
  });

  function handleDraw() {
    const cleaned = prizes.map((p, i) => ({
      position: i + 1,
      prizeDescription: p.prizeDescription.trim() || undefined,
    }));
    draw.mutate({ prizes: cleaned, allowRepeatWinner });
  }

  if (loadingRaffle || loadingWinners) {
    return <PageLoader label="Cargando sorteo..." />;
  }

  if (!raffle) {
    return <EmptyState title="No pudimos cargar la rifa" description="Intenta de nuevo más tarde." />;
  }

  return (
    <div>
      {/* El título y el regreso viven en el header del panel. */}
      <PanelIntro description={`${raffle.eventLabel} · ${raffle.title}`} />

      {/* Aviso: solo boletos pagados */}
      <Card className="mb-4 border-blue-200 bg-blue-50/60 dark:border-blue-900 dark:bg-blue-950/30">
        <CardContent className="flex items-start gap-3 p-4">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
          <div className="text-sm">
            <p className="font-semibold">En el sorteo solo participan boletos pagados.</p>
            <p className="text-muted-foreground">
              Tienes <strong className="text-foreground">{raffle.soldCount.toLocaleString('es-MX')}</strong>{' '}
              boleto(s) pagado(s) que participan.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Animación tómbola */}
      {spinning && (
        <Card className="mb-4 border-amber-300 bg-gradient-to-b from-amber-50 to-background dark:border-amber-900 dark:from-amber-950/40">
          <CardContent className="grid place-items-center gap-2 py-6 sm:py-8">
            <Trophy className="h-8 w-8 animate-bounce text-amber-500" />
            <p className="text-sm font-semibold text-muted-foreground">Sorteando...</p>
            <p className="font-mono text-4xl font-extrabold tabular-nums text-amber-600 dark:text-amber-400 sm:text-5xl">
              {spinValue || '---'}
            </p>
            {pendingWinners && pendingWinners.length > 1 && (
              <p className="text-xs text-muted-foreground">{pendingWinners.length} ganadores en juego</p>
            )}
          </CardContent>
        </Card>
      )}

      {alreadyDrawn ? (
        /* Resultados existentes */
        <div className="grid gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
            Este sorteo ya se realizó. No se puede volver a sortear.
          </div>
          {existingWinners
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((w) => (
              <WinnerCard key={w.id} winner={w} raffleId={raffleId} />
            ))}
          <DrawEvidence raffleId={raffleId} currentUrl={existingWinners[0]?.evidenceUrl ?? null} />
        </div>
      ) : (
        /* Configurador del sorteo */
        <Card>
          <CardHeader>
            <CardTitle>Configura los premios</CardTitle>
            <CardDescription>Agrega una posición por cada ganador que vas a sortear.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              {prizes.map((p, i) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 font-extrabold text-primary">
                    #{p.position}
                  </div>
                  <div className="flex-1">
                    {i === 0 && <Label htmlFor={`prize-${i}`}>Descripción del premio (opcional)</Label>}
                    <Input
                      id={`prize-${i}`}
                      value={p.prizeDescription}
                      onChange={(e) => updatePrize(i, e.target.value)}
                      placeholder={i === 0 ? 'Ej. Premio mayor: la camioneta' : 'Ej. 2do premio: $5,000'}
                    />
                  </div>
                  {prizes.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removePrize(i)}
                      aria-label="Quitar premio"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button type="button" variant="outline" onClick={addPrize} disabled={prizes.length >= 100}>
              <Plus className="h-4 w-4" />
              Agregar premio
            </Button>

            <Separator />

            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Permitir que un boleto gane más de una vez</p>
                <p className="text-xs text-muted-foreground">
                  Si lo activas, un mismo número podría salir en varias posiciones.
                </p>
              </div>
              <Switch checked={allowRepeatWinner} onCheckedChange={setAllowRepeatWinner} />
            </div>

            <Button
              type="button"
              variant="brand"
              size="xl"
              className="w-full"
              loading={draw.isPending || spinning}
              disabled={raffle.soldCount === 0}
              onClick={() => setConfirmOpen(true)}
            >
              <Play className="h-5 w-5" />
              Iniciar sorteo
            </Button>
            {raffle.soldCount === 0 && (
              <p className="text-center text-sm text-destructive">
                No hay boletos pagados. No se puede realizar el sorteo todavía.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* El sorteo es definitivo: confirmar antes de tirar la tómbola. */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Iniciar el sorteo?"
        description={
          <>
            Se elegirá{prizes.length > 1 ? 'n' : ''}{' '}
            <span className="font-semibold text-foreground">
              {prizes.length} ganador{prizes.length > 1 ? 'es' : ''}
            </span>{' '}
            al azar entre los{' '}
            <span className="font-semibold text-foreground">
              {raffle.soldCount.toLocaleString('es-MX')} boletos pagados
            </span>
            . El resultado es definitivo: no se puede repetir el sorteo.
          </>
        }
        confirmLabel="Sí, sortear ahora"
        loading={draw.isPending}
        onConfirm={handleDraw}
      />
    </div>
  );
}
