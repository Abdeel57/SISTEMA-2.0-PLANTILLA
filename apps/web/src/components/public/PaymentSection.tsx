import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Upload, Copy, Clock, CheckCircle2, Loader2, WifiOff } from 'lucide-react';
import { formatMXN, timeRemaining, waReserveMessage, waProofMessage, type DigitalTicketDTO } from '@bismark/shared';
import { ApiError } from '@/lib/api';
import { publicService } from '@/services/publicSite';
import { WhatsAppButton } from '@/components/brand/WhatsAppButton';
import { toast } from 'sonner';

// Sección de pago bajo el boleto: resumen (cuánto pagar), datos del rifero y
// subir comprobante. Pensada para personas mayores: texto y botones grandes.
// `methodsId` / `uploadId` permiten anclar los botones "MÉTODOS DE PAGO" y
// "SUBE TU PAGO AQUÍ" de la barra superior a sus secciones.
export function PaymentSection({
  ticket,
  offline,
  methodsId = 'metodos-de-pago',
  uploadId = 'sube-tu-pago',
}: {
  ticket: DigitalTicketDTO;
  offline: boolean;
  methodsId?: string;
  uploadId?: string;
}) {
  // Boletos digitales viejos en caché podrían no traer los campos de pago.
  if (!ticket.orderCode) return null;

  const count = ticket.ticketNumbers.length;
  const pay = ticket.paymentProfile;

  if (ticket.status === 'PAID') {
    return (
      <div className="mt-5 flex items-center gap-3 rounded-3xl border-2 border-emerald-300 bg-emerald-50 p-5 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
        <CheckCircle2 className="h-9 w-9 shrink-0" />
        <div>
          <p className="text-lg font-extrabold leading-tight">¡Pago confirmado!</p>
          <p className="text-base">Tus boletos ya están pagados. ¡Mucha suerte! 🍀</p>
        </div>
      </div>
    );
  }
  if (ticket.status === 'CANCELLED' || ticket.status === 'REJECTED' || ticket.status === 'EXPIRED') {
    return (
      <div className="mt-5 rounded-3xl border bg-muted/40 p-5 text-center text-base font-semibold text-muted-foreground">
        Esta orden ya no está activa. Si crees que es un error, contacta al rifero.
      </div>
    );
  }

  const remaining = timeRemaining(ticket.expiresAt);
  const hasPayData =
    pay && (pay.holderName || pay.bank || pay.clabe || pay.cardNumber || pay.concept || pay.instructions);

  return (
    <section className="mt-5 space-y-4">
      {/* Resumen: cuánto pagar */}
      <div className="rounded-3xl bg-card p-5 shadow-sm ring-1 ring-border">
        <h2 className="text-xl font-extrabold">¿Cómo pagar?</h2>
        <div className="mt-3 flex items-end justify-between gap-4 rounded-2xl bg-muted/50 p-4">
          <div>
            <p className="text-lg font-bold">
              {count} {count === 1 ? 'boleto' : 'boletos'}
            </p>
            <p className="text-base text-muted-foreground">{formatMXN(ticket.ticketPrice)} cada uno</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total a pagar</p>
            <p className="text-3xl font-extrabold text-[var(--rifero-primary,#1A4DFF)]">
              {formatMXN(ticket.totalAmount)}
            </p>
          </div>
        </div>
        {remaining && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl border-2 border-amber-300 bg-amber-50 p-3 text-base font-semibold text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <Clock className="h-6 w-6 shrink-0" />
            <span>
              Paga en las próximas <strong>{remaining}</strong> para no perder tus boletos.
            </span>
          </div>
        )}
      </div>

      {/* MÉTODOS DE PAGO — datos del rifero */}
      {hasPayData && (
        <div id={methodsId} className="scroll-mt-24 rounded-3xl bg-card p-5 shadow-sm ring-1 ring-border">
          <h3 className="text-lg font-extrabold uppercase tracking-wide">Métodos de pago</h3>
          <dl className="mt-3 space-y-3 text-base">
            {pay.holderName && <PayRow label="Titular" value={pay.holderName} />}
            {pay.bank && <PayRow label="Banco" value={pay.bank} />}
            {pay.clabe && <PayRow label="CLABE" value={pay.clabe} copy mono />}
            {pay.cardNumber && <PayRow label="Tarjeta" value={pay.cardNumber} copy mono />}
            {pay.concept && <PayRow label="Concepto" value={pay.concept} />}
          </dl>
          {pay.instructions && (
            <p className="mt-4 whitespace-pre-line border-t pt-4 text-base text-muted-foreground">{pay.instructions}</p>
          )}
        </div>
      )}

      {/* SUBE TU PAGO AQUÍ — WhatsApp + subir comprobante */}
      <div id={uploadId} className="scroll-mt-24 space-y-3">
        {ticket.riferoWhatsapp && (
          <WhatsAppButton
            phone={ticket.riferoWhatsapp}
            size="lg"
            label="Enviar comprobante por WhatsApp"
            message={waReserveMessage({
              raffleName: ticket.raffleTitle,
              ticketNumbers: ticket.ticketNumbers.join(', '),
              total: formatMXN(ticket.totalAmount),
              orderCode: ticket.orderCode,
              buyerState: ticket.buyerState,
            })}
          />
        )}

        {ticket.allowProofUpload &&
          (offline ? (
            <div className="flex items-center gap-3 rounded-3xl border bg-muted/40 p-4 text-base text-muted-foreground">
              <WifiOff className="h-6 w-6 shrink-0" />
              <span>Conéctate a internet para subir tu comprobante.</span>
            </div>
          ) : (
            <ProofUpload ticket={ticket} />
          ))}
      </div>
    </section>
  );
}

// Subida del comprobante de pago por el comprador (foto, máx. 5 MB).
function ProofUpload({ ticket }: { ticket: DigitalTicketDTO }) {
  const [done, setDone] = useState(false);
  const mutation = useMutation({
    mutationFn: (file: File) => publicService.uploadProof(ticket.orderCode, file),
    onSuccess: () => {
      setDone(true);
      toast.success('¡Comprobante enviado! El rifero lo revisará para confirmar tu pago.');
    },
    onError: (err) =>
      toast.error(err instanceof ApiError ? err.message : 'No se pudo subir el comprobante. Intenta de nuevo.'),
  });

  if (done) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-3xl border-2 border-emerald-300 bg-emerald-50 p-5 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <CheckCircle2 className="h-9 w-9 shrink-0" />
          <div>
            <p className="text-lg font-extrabold leading-tight">¡Comprobante recibido!</p>
            <p className="text-base">El rifero lo revisará para confirmar tu pago.</p>
          </div>
        </div>
        {/* Avisa al organizador por WhatsApp que ya se realizó el pago. */}
        {ticket.riferoWhatsapp && (
          <WhatsAppButton
            phone={ticket.riferoWhatsapp}
            size="lg"
            className="w-full"
            label="Avisar al organizador por WhatsApp"
            message={waProofMessage({
              raffleName: ticket.raffleTitle,
              ticketNumbers: ticket.ticketNumbers.join(', '),
              total: formatMXN(ticket.totalAmount),
              orderCode: ticket.orderCode,
              buyerState: ticket.buyerState,
            })}
          />
        )}
      </div>
    );
  }

  return (
    <div>
      <label
        className={`flex w-full cursor-pointer items-center justify-center gap-3 rounded-2xl bg-[var(--rifero-primary,#1A4DFF)] px-5 py-4 text-lg font-extrabold text-white shadow-lg transition active:scale-[0.98] ${
          mutation.isPending ? 'pointer-events-none opacity-70' : ''
        }`}
      >
        {mutation.isPending ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
        {mutation.isPending ? 'Subiendo…' : 'Subir comprobante de pago'}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={mutation.isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) mutation.mutate(file);
            e.target.value = ''; // permite volver a elegir el mismo archivo
          }}
        />
      </label>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        Toma o elige una foto de tu comprobante (máx. 5 MB).
      </p>
    </div>
  );
}

// Fila de dato de pago, con botón grande de copiar (opcional).
function PayRow({ label, value, copy, mono }: { label: string; value: string; copy?: boolean; mono?: boolean }) {
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error('No se pudo copiar');
    }
  };
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-2">
        <span className={`truncate font-bold ${mono ? 'tabular-nums tracking-wide' : ''}`}>{value}</span>
        {copy && (
          <button
            type="button"
            onClick={onCopy}
            aria-label={`Copiar ${label}`}
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Copy className="h-5 w-5" />
          </button>
        )}
      </dd>
    </div>
  );
}
