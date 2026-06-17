import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Image as ImageIcon } from 'lucide-react';
import {
  RAFFLE_STATUS_LABELS,
  formatMXN,
  formatDateMX,
  type RaffleDTO,
  type RaffleStatus,
} from '@bismark/shared';
import { raffleService } from '@/services/raffles';
import { riferoService } from '@/services/riferos';
import { ApiError, apiAssetUrl } from '@/lib/api';
import { buildRaffleUrl, buildRaffleShareUrl } from '@/lib/site';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageLoader, EmptyState } from '@/components/ui/misc';
import { PanelIntro, PANEL_CARD, ProgressBar } from '@/components/owner/PanelKit';
import { cn } from '@/lib/cn';
import { toast } from 'sonner';

const STATUS_VARIANT: Record<RaffleStatus, BadgeProps['variant']> = {
  DRAFT: 'muted',
  PUBLISHED: 'success',
  FINISHED: 'info',
  CANCELLED: 'danger',
};

function RaffleStatusBadge({ status }: { status: RaffleStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{RAFFLE_STATUS_LABELS[status]}</Badge>;
}

function RaffleCard({ raffle, slug }: { raffle: RaffleDTO; slug?: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Compartir el link público de la rifa (nativo en móvil, copiar en desktop).
  const share = () => {
    if (!slug) return;
    const url = buildRaffleShareUrl(slug, raffle.eventNumber);
    if (navigator.share) {
      void navigator
        .share({ title: raffle.title, text: `Participa en mi rifa "${raffle.title}": ${url}`, url })
        .catch(() => {});
      return;
    }
    navigator.clipboard
      .writeText(url)
      .then(() => toast.success('Link de la rifa copiado. ¡Compártelo!'))
      .catch(() => toast.error('No se pudo copiar el link'));
  };

  const publish = useMutation({
    mutationFn: () => raffleService.publish(raffle.id),
    onSuccess: () => {
      toast.success('Rifa publicada. Ya está visible para tus compradores.');
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

  const remove = useMutation({
    mutationFn: () => raffleService.remove(raffle.id),
    onSuccess: () => {
      toast.success('Rifa eliminada.');
      setConfirmDelete(false);
      void queryClient.invalidateQueries({ queryKey: ['raffles'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'No se pudo eliminar la rifa'),
  });

  const sold = raffle.soldCount;
  const total = raffle.totalTickets;
  const progress = total > 0 ? Math.min(100, Math.round((sold / total) * 100)) : 0;
  const cover = raffle.images[0]?.url;

  return (
    <div className={cn(PANEL_CARD, 'overflow-hidden')}>
      {/* Imagen principal del premio con el evento y el estado superpuestos */}
      <div className="relative aspect-[16/9] w-full bg-muted">
        {cover ? (
          <img
            src={apiAssetUrl(cover)}
            alt={raffle.title}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-muted-foreground/50">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}
        {/* Degradado inferior para que los chips se lean sobre cualquier foto */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/45 to-transparent" />
        <span className="absolute left-3 top-3 rounded-lg bg-white/90 px-2 py-0.5 text-xs font-extrabold tracking-wide text-primary shadow-sm backdrop-blur">
          {raffle.eventLabel}
        </span>
        <div className="absolute right-3 top-3">
          <RaffleStatusBadge status={raffle.status} />
        </div>
      </div>

      <div className="p-4">
      {/* Título */}
      <h3 className="text-lg font-extrabold leading-tight tracking-tight">{raffle.title}</h3>
      {raffle.prize && <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">Premio: {raffle.prize}</p>}

      {/* Precio + ingresos */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-bold">{formatMXN(raffle.ticketPrice)}</span>
        <span className="text-muted-foreground">por boleto</span>
        <span className="ml-auto font-bold text-emerald-600 dark:text-emerald-400">
          {formatMXN(raffle.estimatedRevenue)}
        </span>
      </div>

      {/* Barra de progreso de venta */}
      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground">{sold.toLocaleString('es-MX')}</strong> de{' '}
            {total.toLocaleString('es-MX')} vendidos
          </span>
          <span className="font-bold text-primary">{progress}%</span>
        </div>
        <ProgressBar value={progress} />
      </div>

      {/* Fecha de sorteo */}
      {raffle.drawDate && (
        <p className="mt-3 text-xs text-muted-foreground">Sorteo: {formatDateMX(raffle.drawDate)}</p>
      )}

      {/* Acciones */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => navigate(`/admin/rifas/${raffle.id}/editar`)}>
          Editar
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate(`/admin/rifas/${raffle.id}/boletos`)}>
          Boletos
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate(`/admin/rifas/${raffle.id}/sorteo`)}>
          Sorteo
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate(`/admin/rifas/${raffle.id}/promociones`)}>
          Promociones
        </Button>
      </div>

      {/* Acción primaria según el estado de la rifa */}
      {raffle.status === 'DRAFT' && (
        <Button variant="brand" className="mt-2 w-full" loading={publish.isPending} onClick={() => publish.mutate()}>
          Publicar rifa
        </Button>
      )}
      {raffle.status === 'PUBLISHED' && slug && (
        <Button variant="brand" className="mt-2 w-full" onClick={share}>
          Compartir rifa
        </Button>
      )}
      {raffle.status === 'FINISHED' && slug && (
        <Button asChild variant="outline" className="mt-2 w-full">
          <a href={buildRaffleUrl(slug, raffle.eventNumber)} target="_blank" rel="noopener noreferrer">
            Ver resultado público
          </a>
        </Button>
      )}

      {/* Eliminar rifa (acción destructiva, con confirmación) */}
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-destructive"
      >
        <Trash2 className="h-3.5 w-3.5" /> Eliminar rifa
      </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="¿Eliminar esta rifa?"
        description={
          <>
            Se eliminará <span className="font-semibold">{raffle.title}</span> ({raffle.eventLabel}) junto con sus
            boletos, apartados, imágenes y promociones. Esta acción no se puede deshacer.
          </>
        }
        confirmLabel="Sí, eliminar"
        destructive
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </div>
  );
}

export default function RafflesList() {
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['raffles'],
    queryFn: () => raffleService.list(),
  });
  const profileQ = useQuery({ queryKey: ['rifero', 'me'], queryFn: () => riferoService.me() });
  const slug = profileQ.data?.profile.slug;

  const raffles = data?.items ?? [];

  return (
    <div>
      <PanelIntro
        description="Crea, publica y administra tus sorteos."
        action={
          <Button variant="brand" size="sm" onClick={() => navigate('/admin/rifas/nueva')}>
            <Plus className="h-4 w-4" /> Nueva rifa
          </Button>
        }
      />

      {isLoading ? (
        <PageLoader label="Cargando tus rifas..." />
      ) : isError ? (
        <EmptyState
          title="No pudimos cargar tus rifas"
          description={error instanceof ApiError ? error.message : 'Algo salió mal. Intenta de nuevo.'}
        />
      ) : raffles.length === 0 ? (
        <EmptyState
          title="Aún no tienes rifas"
          description="Crea tu primera rifa y empieza a vender boletos en minutos."
          action={
            <Button variant="brand" onClick={() => navigate('/admin/rifas/nueva')}>
              <Plus className="h-4 w-4" /> Crear mi primera rifa
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {raffles.map((raffle) => (
            <RaffleCard key={raffle.id} raffle={raffle} slug={slug} />
          ))}
        </div>
      )}
    </div>
  );
}
