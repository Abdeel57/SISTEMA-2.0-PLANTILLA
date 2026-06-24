import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, FileText, FileBarChart, Receipt, Ticket, Users } from 'lucide-react';
import { RAFFLE_STATUS_LABELS } from '@bismark/shared';
import type { RaffleDTO } from '@bismark/shared';
import { raffleService } from '@/services/raffles';
import { reportService, type ReportType, type ReportFormat } from '@/services/payments';
import { ApiError } from '@/lib/api';
import { PanelIntro } from '@/components/owner/PanelKit';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageLoader, EmptyState } from '@/components/ui/misc';
import { toast } from 'sonner';

const REPORT_TYPES: { type: ReportType; label: string; icon: typeof Receipt }[] = [
  { type: 'orders', label: 'Órdenes', icon: Receipt },
  { type: 'tickets', label: 'Boletos', icon: Ticket },
  { type: 'buyers', label: 'Compradores', icon: Users },
];

function RaffleReportCard({ raffle }: { raffle: RaffleDTO }) {
  const [downloading, setDownloading] = useState<string | null>(null);

  const download = async (type: ReportType, format: ReportFormat) => {
    const key = `${type}-${format}`;
    setDownloading(key);
    try {
      await reportService.download(raffle.id, type, format, raffle.eventLabel);
      toast.success('Reporte descargado');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'No se pudo descargar el reporte');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate">
              <span className="mr-1.5 text-muted-foreground">{raffle.eventLabel}</span>
              {raffle.title}
            </CardTitle>
            <CardDescription>
              {raffle.soldCount} pagados · {raffle.reservedCount} apartados
            </CardDescription>
          </div>
          <Badge variant="muted" className="shrink-0">
            {RAFFLE_STATUS_LABELS[raffle.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {REPORT_TYPES.map(({ type, label, icon: Icon }) => (
          <div key={type} className="flex items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate text-sm font-medium">{label}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={downloading !== null}
              loading={downloading === `${type}-excel`}
              onClick={() => download(type, 'excel')}
            >
              <FileSpreadsheet className="h-4 w-4" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={downloading !== null}
              loading={downloading === `${type}-pdf`}
              onClick={() => download(type, 'pdf')}
            >
              <FileText className="h-4 w-4" />
              PDF
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function Reports() {
  const { data, isLoading } = useQuery({
    queryKey: ['raffles', 'list'],
    queryFn: () => raffleService.list(),
  });
  const raffles = data?.items ?? [];

  if (isLoading) return <PageLoader label="Cargando tus reportes..." />;

  return (
    <div>
      <PanelIntro description="Descarga la información de tus rifas en Excel o PDF." />

      {raffles.length === 0 ? (
        <EmptyState
          icon={<FileBarChart className="h-10 w-10" />}
          title="Aún no tienes rifas"
          description="Crea tu primera rifa para empezar a generar reportes."
        />
      ) : (
        <div className="space-y-4">
          {raffles.map((raffle) => (
            <RaffleReportCard key={raffle.id} raffle={raffle} />
          ))}
        </div>
      )}
    </div>
  );
}
