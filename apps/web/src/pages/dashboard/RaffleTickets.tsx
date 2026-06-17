import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ListPlus, User, Hash, Gift } from 'lucide-react';
import { TICKET_STATUS_LABELS, dialCodeForCountry, type TicketStatus } from '@bismark/shared';
import { raffleService } from '@/services/raffles';
import { ticketService } from '@/services/tickets';
import { ApiError } from '@/lib/api';
import { decodeTicketMap, applyTicketChanges, type TicketMapData } from '@/lib/ticketMap';
import { useTicketChanges } from '@/lib/pwa/useTicketChanges';
import { PanelIntro } from '@/components/owner/PanelKit';
import { TicketGrid } from '@/components/TicketGrid';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TicketStatusBadge } from '@/lib/statusBadges';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { PageLoader, EmptyState, Separator } from '@/components/ui/misc';
import { toast } from 'sonner';

// Parsea "1,2,3" y rangos "10-15" a una lista de números únicos ordenados.
function parseTicketNumbers(input: string): number[] {
  const set = new Set<number>();
  for (const raw of input.split(/[,\n;\s]+/)) {
    const token = raw.trim();
    if (!token) continue;
    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const a = Number(range[1]);
      const b = Number(range[2]);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      for (let n = lo; n <= hi; n++) set.add(n);
    } else if (/^\d+$/.test(token)) {
      set.add(Number(token));
    }
  }
  return [...set].sort((a, b) => a - b);
}

export default function RaffleTickets() {
  const { id } = useParams<{ id: string }>();
  const raffleId = id as string;
  const queryClient = useQueryClient();

  // Número del boleto abierto en el diálogo; su detalle se pide bajo demanda.
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const { data: raffleData, isLoading: loadingRaffle } = useQuery({
    queryKey: ['raffle', raffleId],
    queryFn: () => raffleService.get(raffleId),
  });

  // Mapa compacto (1 byte por boleto): escala a 1,000,000 de boletos.
  const mapQuery = useQuery({
    queryKey: ['owner-ticket-map', raffleId],
    queryFn: () => raffleService.ownerTicketMap(raffleId),
  });
  const [ticketMap, setTicketMap] = useState<TicketMapData | null>(null);
  useEffect(() => {
    if (mapQuery.data) setTicketMap(decodeTicketMap(mapQuery.data));
  }, [mapQuery.data]);

  const raffle = raffleData?.raffle;

  // Detalle del boleto seleccionado (comprador/orden), solo cuando se abre.
  const detailQuery = useQuery({
    queryKey: ['owner-ticket', raffleId, selectedNumber],
    queryFn: () => raffleService.ownerTicket(raffleId, selectedNumber!),
    enabled: selectedNumber !== null,
  });
  const selected = selectedNumber !== null ? (detailQuery.data?.ticket ?? null) : null;

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['owner-ticket-map', raffleId] });
    void queryClient.invalidateQueries({ queryKey: ['raffle', raffleId] });
  }

  // Tiempo real (contrato C2): los cambios incrementales parchan el mapa en
  // memoria (sin recargar todos los boletos) y refrescan los conteos.
  useTicketChanges(
    raffleId,
    (items) => {
      setTicketMap((m) => (m ? applyTicketChanges(m, items) : m));
      void queryClient.invalidateQueries({ queryKey: ['raffle', raffleId] });
    },
    selectedNumber === null && !bulkOpen,
  );

  const setStatus = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: TicketStatus }) =>
      ticketService.setStatus(ticketId, status),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.status === 'RIFERO_RESERVED' ? 'Boleto reservado para ti.' : 'Boleto liberado.',
      );
      invalidate();
      setSelectedNumber(null);
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo actualizar el boleto'),
  });

  const reserveManual = useMutation({
    mutationFn: (numbers: number[]) => ticketService.reserveManual(raffleId, numbers),
    onSuccess: (res) => {
      toast.success(`${res.reserved} boleto(s) reservado(s) para ti.`);
      invalidate();
      setBulkOpen(false);
      setBulkText('');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudieron reservar los boletos'),
  });

  function handleBulkSubmit() {
    const numbers = parseTicketNumbers(bulkText);
    if (numbers.length === 0) {
      toast.error('Escribe al menos un número de boleto válido.');
      return;
    }
    reserveManual.mutate(numbers);
  }

  const parsedPreview = useMemo(() => parseTicketNumbers(bulkText), [bulkText]);

  if (loadingRaffle || (!ticketMap && !mapQuery.isError)) {
    return <PageLoader label="Cargando boletos..." />;
  }

  if (mapQuery.isError || !raffle || !ticketMap) {
    return <EmptyState title="No pudimos cargar los boletos" description="Intenta de nuevo más tarde." />;
  }

  return (
    <div>
      {/* El título y el regreso viven en el header del panel. */}
      <PanelIntro
        description={`${raffle.eventLabel} · ${raffle.title}`}
        action={
          <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
            <ListPlus className="h-4 w-4" />
            Reservar varios
          </Button>
        }
      />

      {/* Resumen de conteos */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
              {raffle.soldCount.toLocaleString('es-MX')}
            </p>
            <p className="text-xs text-muted-foreground">Vendidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-extrabold text-amber-600 dark:text-amber-400">
              {raffle.reservedCount.toLocaleString('es-MX')}
            </p>
            <p className="text-xs text-muted-foreground">Apartados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {raffle.availableCount.toLocaleString('es-MX')}
            </p>
            <p className="text-xs text-muted-foreground">Disponibles</p>
          </CardContent>
        </Card>
      </div>

      <TicketGrid map={ticketMap} onTicketClick={(t) => setSelectedNumber(t.number)} />

      {/* Dialog de boleto individual (el detalle se carga bajo demanda) */}
      <Dialog open={selectedNumber !== null} onOpenChange={(open) => !open && setSelectedNumber(null)}>
        <DialogContent>
          {selectedNumber !== null && detailQuery.isLoading && <PageLoader label="Cargando boleto..." />}
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  Boleto {selected.displayNumber}
                </DialogTitle>
                <DialogDescription>Información y acciones del boleto.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estado</span>
                  <TicketStatusBadge status={selected.status as TicketStatus} />
                </div>

                {/* Oportunidades: marca de regalo + boleto manual que lo generó */}
                {selected.isGift && (
                  <div className="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2">
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                      <Gift className="h-4 w-4" /> Boleto de regalo
                    </span>
                    {selected.parentDisplayNumber && (
                      <span className="text-xs text-muted-foreground">
                        de <span className="font-mono font-semibold">{selected.parentDisplayNumber}</span>
                      </span>
                    )}
                  </div>
                )}

                {selected.buyer ? (
                  <>
                    <Separator />
                    <div className="grid gap-1">
                      <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {selected.buyer.fullName}
                      </p>
                      <p className="text-sm text-muted-foreground tabular-nums">
                        +{dialCodeForCountry(selected.buyer.country)} {selected.buyer.phone}
                      </p>
                      {selected.buyer.state && (
                        <p className="text-sm text-muted-foreground">{selected.buyer.state}</p>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Este boleto está {TICKET_STATUS_LABELS[selected.status as TicketStatus].toLowerCase()} y no
                    tiene comprador asignado.
                  </p>
                )}
              </div>

              <DialogFooter>
                {selected.status === 'AVAILABLE' && (
                  <Button
                    variant="default"
                    loading={setStatus.isPending}
                    onClick={() =>
                      setStatus.mutate({ ticketId: selected.id, status: 'RIFERO_RESERVED' })
                    }
                  >
                    Reservar para mí
                  </Button>
                )}
                {selected.status === 'RIFERO_RESERVED' && (
                  <Button
                    variant="outline"
                    loading={setStatus.isPending}
                    onClick={() => setStatus.mutate({ ticketId: selected.id, status: 'AVAILABLE' })}
                  >
                    Liberar boleto
                  </Button>
                )}
                <Button variant="ghost" onClick={() => setSelectedNumber(null)}>
                  Cerrar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog reservar varios */}
      <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reservar varios boletos</DialogTitle>
            <DialogDescription>
              Escribe los números separados por coma. Puedes usar rangos, por ejemplo: 1, 5, 10-20.
            </DialogDescription>
          </DialogHeader>

          <div>
            <Label htmlFor="bulk">Números de boleto</Label>
            <Textarea
              id="bulk"
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder="Ej. 1, 2, 3, 10-25"
              className="font-mono"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {parsedPreview.length > 0
                ? `Se reservarán ${parsedPreview.length} boleto(s) disponibles para ti.`
                : 'Aún no hay números válidos.'}
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="brand"
              loading={reserveManual.isPending}
              disabled={parsedPreview.length === 0}
              onClick={handleBulkSubmit}
            >
              Reservar {parsedPreview.length > 0 ? parsedPreview.length : ''} boletos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
