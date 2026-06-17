import { useState } from 'react';
import { Delete, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import { TicketStatus, formatTicketNumber } from '@bismark/shared';
import { statusOfNumber, type TicketMapData } from '@/lib/ticketMap';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Mapa compacto de boletos de la rifa (estado por número, O(1)). */
  map: TicketMapData | null;
  /** Selección actual de PublicRaffle (el puente C4). */
  selected: number[];
  /** Setter de la selección de PublicRaffle. */
  onSelect: (next: number[]) => void;
}

type Feedback =
  | { kind: 'added'; label: string }
  | { kind: 'already'; label: string }
  | { kind: 'taken'; label: string }
  | { kind: 'missing'; label: string }
  | { kind: 'range' }
  | null;

/**
 * "Ir a mi número": teclado numérico GRANDE para que una persona mayor escriba
 * su número de la suerte y lo agregue a la selección de un toque, sin tener que
 * buscarlo arrastrando por la cuadrícula.
 *
 * No toca TicketGrid: opera sobre la misma selección (`selected`/`onSelect`)
 * que PublicRaffle ya controla (contrato C4).
 */
export function GoToNumber({ open, onOpenChange, map, selected, onSelect }: Props) {
  const [digits, setDigits] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);

  const ticketFormat = map?.format ?? 3;
  const lastNumber = map ? map.start + map.total - 1 : 0;
  const maxLen = Math.max(ticketFormat, String(Math.max(lastNumber, 0)).length);

  const pad = (n: number) => formatTicketNumber(n, ticketFormat);

  const reset = () => {
    setDigits('');
    setFeedback(null);
  };

  const press = (d: string) => {
    setFeedback(null);
    setDigits((cur) => (cur.length >= maxLen ? cur : (cur + d).replace(/^0+(?=\d)/, '')));
  };

  const backspace = () => {
    setFeedback(null);
    setDigits((cur) => cur.slice(0, -1));
  };

  const submit = () => {
    if (digits === '' || !map) return;
    const num = parseInt(digits, 10);
    // El estado por número es O(1) sobre el mapa; undefined = fuera de rango.
    const status = Number.isFinite(num) ? statusOfNumber(map, num) : undefined;
    if (status === undefined) {
      setFeedback({ kind: 'range' });
      return;
    }
    const label = pad(num);
    if (selected.includes(num)) {
      setFeedback({ kind: 'already', label });
      return;
    }
    if (status !== TicketStatus.AVAILABLE) {
      setFeedback({ kind: 'taken', label });
      return;
    }
    onSelect([...selected, num]);
    setFeedback({ kind: 'added', label });
    setDigits('');
  };

  const close = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-2xl">Ir a mi número</DialogTitle>
          <DialogDescription className="text-base">
            Escribe tu número de la suerte y tócalo en "Agregar".
          </DialogDescription>
        </DialogHeader>

        {/* Pantalla con el número tecleado, bien grande */}
        <div
          className="flex h-20 items-center justify-center rounded-2xl border-2 border-input bg-muted/50 text-5xl font-black tabular-nums tracking-widest"
          aria-live="polite"
        >
          {digits === '' ? <span className="text-muted-foreground/40">—</span> : pad(parseInt(digits, 10))}
        </div>

        {/* Mensaje claro de resultado */}
        {feedback && (
          <div
            role="status"
            className={
              'flex items-center gap-2 rounded-xl p-3 text-base font-bold ' +
              (feedback.kind === 'added'
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200')
            }
          >
            {feedback.kind === 'added' ? (
              <CheckCircle2 className="h-6 w-6 shrink-0" />
            ) : (
              <AlertTriangle className="h-6 w-6 shrink-0" />
            )}
            <span>
              {feedback.kind === 'added' && `Boleto ${feedback.label} agregado.`}
              {feedback.kind === 'already' && `El boleto ${feedback.label} ya está en tu selección.`}
              {feedback.kind === 'taken' && `El boleto ${feedback.label} ya está apartado. Elige otro.`}
              {feedback.kind === 'missing' && `No encontramos el boleto ${feedback.label}.`}
              {feedback.kind === 'range' && `Ese número no existe en esta rifa.`}
            </span>
          </div>
        )}

        {/* Teclado numérico grande (targets ≥ 64px) */}
        <div className="grid grid-cols-3 gap-2.5">
          {keys.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => press(k)}
              className="h-16 rounded-2xl border-2 border-input bg-background text-3xl font-extrabold tabular-nums transition-colors hover:bg-accent active:scale-[0.97]"
            >
              {k}
            </button>
          ))}
          <button
            type="button"
            onClick={backspace}
            aria-label="Borrar"
            className="grid h-16 place-items-center rounded-2xl border-2 border-input bg-background transition-colors hover:bg-accent active:scale-[0.97]"
          >
            <Delete className="h-7 w-7" />
          </button>
          <button
            type="button"
            onClick={() => press('0')}
            className="h-16 rounded-2xl border-2 border-input bg-background text-3xl font-extrabold tabular-nums transition-colors hover:bg-accent active:scale-[0.97]"
          >
            0
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={digits === ''}
            aria-label="Agregar este número"
            className="grid h-16 place-items-center rounded-2xl bg-[var(--rifero-primary)] text-white transition-transform active:scale-[0.97] disabled:opacity-40"
          >
            <Search className="h-7 w-7" />
          </button>
        </div>

        <Button type="button" size="lg" className="w-full text-base" onClick={() => close(false)}>
          Listo
        </Button>
      </DialogContent>
    </Dialog>
  );
}
