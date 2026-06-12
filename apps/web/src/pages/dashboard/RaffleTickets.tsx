import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ListPlus, User, Hash } from 'lucide-react';
import {
  TICKET_STATUS_LABELS,
  type TicketLiteDTO,
  type TicketStatus,
} from '@bismark/shared';
import { raffleService, type OwnerTicketDTO } from '@/services/raffles';
import { ticketService } from '@/services/tickets';
import { ApiError } from '@/lib/api';
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

  const [selected, setSelected] = useState<OwnerTicketDTO | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');

  const { data: raffleData, isLoading: loadingRaffle } = useQuery({
    queryKey: ['raffle', raffleId],
    queryFn: () => raffleService.get(raffleId),
  });

  const {
    data: ticketsData,
    isLoading: loadingTickets,
    isError,
  } = useQuery({
    queryKey: ['owner-tickets', raffleId],
    queryFn: () => raffleService.ownerTickets(raffleId),
  });

  const raffle = raffleData?.raffle;
  const ownerTickets = ticketsData?.items ?? [];

  const liteTickets: TicketLiteDTO[] = useMemo(
    () =>
      ownerTickets.map((t) => ({
        number: t.number,
        displayNumber: t.displayNumber,
        status: t.status as TicketStatus,
      })),
    [ownerTickets],
  );

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['owner-tickets', raffleId] });
    void queryClient.invalidateQueries({ queryKey: ['raffle', raffleId] });
  }

  // Tiempo real (contrato C2): cuando un comprador aparta/paga, refrescamos los
  // boletos del rifero. No tocamos TicketGrid; solo invalidamos para recargar
  // los datos completos (incluye comprador). Inactivo si hay un diálogo abierto.
  useTicketChanges(
    raffleId,
    () => invalidate(),
    selected === null && !bulkOpen,
  );

  const setStatus = useMutation({
    mutationFn: ({ ticketId, status }: { ticketId: string; status: TicketStatus }) =>
      ticketService.setStatus(ticketId, status),
    onSuccess: (_data, vars) => {
      toast.success(
        vars.status === 'RIFERO_RESERVED' ? 'Boleto reservado para ti.' : 'Boleto liberado.',
      );
      invalidate();
      setSelected(null);
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

  if (loadingRaffle || loadingTickets) {
    return <PageLoader label="Cargando boletos..." />;
  }

  if (isError || !raffle) {
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

      <TicketGrid
        tickets={liteTickets}
        onTicketClick={(t) => {
          const owner = ownerTickets.find((o) => o.number === t.number) ?? null;
          setSelected(owner);
        }}
      />

      {/* Dialog de boleto individual */}
      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
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

                {selected.buyer ? (
                  <>
                    <Separator />
                    <div className="grid gap-1">
                      <p className="inline-flex items-center gap-1.5 text-sm font-semibold">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {selected.buyer.fullName}
                      </p>
                      <p className="text-sm text-muted-foreground">{selected.buyer.phone}</p>
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
                <Button variant="ghost" onClick={() => setSelected(null)}>
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
