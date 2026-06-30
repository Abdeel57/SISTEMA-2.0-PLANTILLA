import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Ticket,
  Trophy,
  Copy,
  Download,
  ExternalLink,
  CheckCircle2,
  Triangle,
  X,
  Hash,
  ChevronDown,
  FileText,
} from 'lucide-react';
import {
  formatMXN,
  formatDateMX,
  waReserveMessage,
  buildWhatsappLink,
  computeOrderPrice,
  nextDealHint,
  MEXICAN_STATES,
  US_STATES,
  PHONE_COUNTRIES,
  type BuyerInput,
  type OrderReceiptDTO,
} from '@bismark/shared';
import { ApiError, apiAssetUrl } from '@/lib/api';
import { sanitizeHtml, isRichHtml } from '@/lib/sanitizeHtml';
import { decodeTicketMap, applyTicketChanges, type TicketMapData } from '@/lib/ticketMap';
import { useTicketChanges } from '@/lib/pwa/useTicketChanges';
import { track } from '@/lib/analytics';
import { publicService } from '@/services/publicSite';
import { ticketService } from '@/services/tickets';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useHideOnScroll } from '@/hooks/useHideOnScroll';
import { useImagesReady } from '@/hooks/useImagesReady';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/misc';
import { BrandLoader } from '@/components/brand/BrandLoader';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { RiferoTheme } from '@/components/brand/RiferoTheme';
import { WhatsAppButton } from '@/components/brand/WhatsAppButton';
import { PoweredBy } from '@/components/brand/PoweredBy';
import { BismarkCta } from '@/components/brand/BismarkCta';
import { TicketGrid } from '@/components/TicketGrid';
import { GoToNumber } from '@/components/public/GoToNumber';
import { RaffleBrandBar, BAR_TOTAL } from '@/components/public/RaffleBrandBar';
import { PromoBanner } from '@/components/public/PromoBanner';
import { PaymentCard } from '@/components/public/PaymentCard';
import { SafeSeal } from '@/components/public/SafeSeal';
import { RaffleCountdown } from '@/components/public/RaffleCountdown';
import { ReserveTimer } from '@/components/public/ReserveTimer';
import { recallBuyer, rememberBuyer } from '@/lib/offline/buyerMemory';
import { rememberReferral, getReferral } from '@/lib/referral';
import { toast } from 'sonner';

interface Props {
  subdomain?: string;
}

// Formulario del comprador (estilo referencia: País · WhatsApp · Nombre(s) · Apellidos · Estado).
const reserveFormSchema = z.object({
  // País del teléfono: México (+52) por defecto; USA (+1) para clientes en USA.
  country: z.string().min(2).max(2).default('MX'),
  whatsapp: z.string().min(10, 'Escribe tu WhatsApp (10 dígitos)').max(20),
  nombres: z.string().trim().min(2, 'Escribe tu(s) nombre(s)').max(60),
  // Opcional: permite nombres de una sola palabra y el prellenado de nombres ya guardados.
  apellidos: z.string().trim().max(60).optional().or(z.literal('')),
  state: z.string().max(60).optional().or(z.literal('')),
});
type ReserveFormInput = z.infer<typeof reserveFormSchema>;

// Separa un nombre completo guardado en nombres / apellidos (para prellenar).
function splitName(full: string): { nombres: string; apellidos: string } {
  const w = (full || '').trim().split(/\s+/).filter(Boolean);
  if (w.length <= 1) return { nombres: w[0] ?? '', apellidos: '' };
  return { nombres: w.slice(0, -1).join(' '), apellidos: w[w.length - 1] };
}

// ── Galería del premio: swipe con el dedo, sin flechas ni miniaturas ──
function PrizeGallery({ images, title }: { images: { id: string; url: string }[]; title: string }) {
  const [index, setIndex] = useState(0);
  const touchX = useRef<number | null>(null);

  if (images.length === 0) {
    return (
      <div className="grid aspect-[4/3] w-full place-items-center bg-muted">
        <Ticket className="h-12 w-12 text-muted-foreground/50" />
      </div>
    );
  }

  const count = images.length;
  const safeIndex = Math.min(index, count - 1);
  const current = images[safeIndex];
  const go = (dir: number) => setIndex((i) => (i + dir + count) % count);

  return (
    <div
      className="relative aspect-[4/3] w-full select-none overflow-hidden bg-muted"
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (count > 1 && Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
      }}
    >
      <img
        src={apiAssetUrl(current.url)}
        alt={title}
        draggable={false}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

// Lista de boletos del recibo. Muestra SIEMPRE, sin clics, los boletos elegidos
// y —si la rifa dio oportunidades— los números de regalo con sus números reales
// (no solo la cantidad). Sin regalos, solo la lista de boletos.
function ReceiptTickets({ ticketNumbers, giftNumbers }: { ticketNumbers: string[]; giftNumbers: string[] }) {
  const hasGifts = giftNumbers.length > 0;

  return (
    <>
      <p className="mb-1 text-[11px] text-muted-foreground">Tus boletos ({ticketNumbers.length})</p>
      <p className="text-sm font-semibold tabular-nums">{ticketNumbers.join(', ')}</p>

      {hasGifts && (
        <div className="mt-3 rounded-lg bg-[var(--rifero-primary)]/8 p-2.5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--rifero-primary)]">
            🎁 Boletos de regalo ({giftNumbers.length})
          </p>
          <p className="mt-0.5 text-sm font-semibold tabular-nums">{giftNumbers.join(', ')}</p>
          <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
            Por cada boleto que apartaste recibiste oportunidades adicionales de regalo. Participas con{' '}
            <strong>{ticketNumbers.length + giftNumbers.length}</strong> números en total.
          </p>
        </div>
      )}
    </>
  );
}

export default function PublicRaffle({ subdomain }: Props) {
  const params = useParams<{ slug: string; eventParam: string; ref?: string }>();
  const slug = subdomain ?? params.slug ?? '';
  const eventNumber = parseInt((params.eventParam ?? '').replace(/^e/i, ''), 10);

  // Captura la referencia del vendedor (de /eN/CODE o ?ref=CODE) para atribuir
  // la venta al apartar. Persiste en la sesión aunque el comprador navegue.
  useEffect(() => {
    rememberReferral(params.ref ?? new URLSearchParams(window.location.search).get('ref'));
  }, [params.ref]);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<number[]>([]);
  const [buyerOpen, setBuyerOpen] = useState(false);
  const [goToOpen, setGoToOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [folioOpen, setFolioOpen] = useState(false);
  const [folio, setFolio] = useState('');
  const [receipt, setReceipt] = useState<OrderReceiptDTO | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-raffle', slug, eventNumber],
    queryFn: () => publicService.raffleByEvent(slug, eventNumber),
    enabled: !!slug && Number.isFinite(eventNumber),
  });

  const raffle = data?.raffle;

  // Mapa compacto de boletos (1 byte por boleto): escala a 1,000,000.
  const mapQuery = useQuery({
    queryKey: ['public-ticket-map', raffle?.id],
    queryFn: () => publicService.raffleTicketMap(raffle!.id),
    enabled: !!raffle?.id,
  });
  const [ticketMap, setTicketMap] = useState<TicketMapData | null>(null);
  useEffect(() => {
    if (mapQuery.data) setTicketMap(decodeTicketMap(mapQuery.data));
  }, [mapQuery.data]);

  // Tiempo real: parcha el mapa con los cambios incrementales (cada ~4.5 s).
  useTicketChanges(raffle?.id, (items) => {
    setTicketMap((m) => (m ? applyTicketChanges(m, items) : m));
  });

  // ── Vista previa de los NÚMEROS de regalo (oportunidades) ──────────────────
  // Al seleccionar, el backend sortea al azar números de regalo DISPONIBLES y los
  // mostramos antes de apartar. No se reservan aquí; al apartar se reservan esos
  // mismos (y se rellenan al azar si alguno ya se tomó). Random real y visible.
  const giftsPerManual = Math.max(0, (raffle?.opportunities ?? 1) - 1);
  const giftCount = giftsPerManual * selected.length;
  const [giftPreviewNumbers, setGiftPreviewNumbers] = useState<{ number: number; displayNumber: string }[]>([]);
  useEffect(() => {
    const rid = raffle?.id;
    if (!rid || giftCount <= 0) {
      setGiftPreviewNumbers([]);
      return;
    }
    let cancelled = false;
    // Debounce: evita un sorteo por cada toque al agregar/quitar boletos rápido.
    const t = setTimeout(() => {
      ticketService
        .drawGifts(rid, giftCount)
        .then((res) => {
          if (!cancelled) setGiftPreviewNumbers(res.gifts);
        })
        .catch(() => {
          /* si falla, queda solo el conteo; al apartar el backend los sortea igual */
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [raffle?.id, giftCount]);

  const form = useForm<ReserveFormInput>({
    resolver: zodResolver(reserveFormSchema),
    defaultValues: { country: 'MX', whatsapp: '', nombres: '', apellidos: '', state: '' },
  });

  const reserveMutation = useMutation({
    mutationFn: (buyer: BuyerInput) =>
      ticketService.reserve(raffle!.id, {
        buyer: { ...buyer, whatsapp: buyer.whatsapp || buyer.phone },
        ticketNumbers: selected,
        // Regalos que el comprador vio sorteados: el backend reserva estos mismos
        // (y rellena al azar si alguno ya se tomó). Vacío = los sortea el backend.
        giftNumbers: giftPreviewNumbers.map((g) => g.number),
        // Atribuye la venta al vendedor cuyo link trajo al comprador (si hay).
        sellerCode: getReferral() ?? '',
      }),
    onSuccess: (res, variables) => {
      track('order_reserved', {
        ticketCount: res.receipt.ticketNumbers.length,
        totalAmount: res.receipt.totalAmount,
      });
      setBuyerOpen(false);
      setSelected([]);
      form.reset({ country: 'MX', whatsapp: '', nombres: '', apellidos: '', state: '' });
      void queryClient.invalidateQueries({ queryKey: ['public-ticket-map', raffle?.id] });

      // Si el sitio NO recibe comprobantes en la plataforma, al apartar mandamos al
      // comprador directo a WhatsApp del rifero con el resumen de su apartado y la
      // liga a los "Métodos de pago" de esta página (?pago=1 abre el modal de datos
      // bancarios) para que sepa a dónde transferir.
      const waNumber = res.receipt.riferoWhatsapp || raffle?.rifero.whatsapp || '';
      if (raffle && !raffle.allowProofUpload && waNumber) {
        const paymentUrl = `${window.location.origin}${window.location.pathname}?pago=1`;
        const message = waReserveMessage({
          raffleName: raffle.title,
          ticketNumbers: res.receipt.ticketNumbers.join(', '),
          giftNumbers: res.receipt.giftNumbers.join(', '),
          total: formatMXN(res.receipt.totalAmount),
          orderCode: res.receipt.code,
          buyerName: variables.fullName,
          buyerPhone: variables.phone,
          paymentUrl,
        });
        window.location.href = buildWhatsappLink(waNumber, message);
        return;
      }

      // Comportamiento normal: ir a "Verificar boletos" (con su teléfono): ahí ve su
      // orden, sube el comprobante, ve los números de cuenta y, una vez que el
      // organizador confirme el pago, abre su boleto digital.
      const tel = encodeURIComponent(variables.phone);
      navigate(`/verificar?tel=${tel}`);
    },
    onError: (err) => {
      // Boletos ya no disponibles u otro error: refrescar cuadrícula.
      toast.error(err instanceof ApiError ? err.message : 'No se pudo apartar. Intenta de nuevo.');
      void queryClient.invalidateQueries({ queryKey: ['public-ticket-map', raffle?.id] });
      setBuyerOpen(false);
    },
  });

  // La pestaña muestra el nombre de la página de rifas, no el del evento.
  useDocumentTitle(raffle?.rifero.publicName);

  // Cintillo + promo + panel se ocultan/reaparecen en sincronía al hacer scroll.
  const barHidden = useHideOnScroll();

  // Liga "Métodos de pago" (?pago=1): abre el modal de datos de pago al cargar.
  // Es la liga que recibe el comprador en su mensaje de WhatsApp tras apartar.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('pago') === '1') {
      setPayOpen(true);
    }
  }, []);

  // Sostener la pantalla de carga hasta que el logo y TODAS las imágenes del
  // premio (galería) estén listas, para que la página no se vea "armándose" con
  // las imágenes apareciendo. El hook tiene tope de seguridad para imágenes
  // rotas o lentas.
  const prizeImages = (raffle?.images ?? []).map((im) =>
    im?.url ? apiAssetUrl(im.url) : null,
  );
  const criticalImageUrls = [
    raffle?.rifero?.logoUrl ? apiAssetUrl(raffle.rifero.logoUrl) : null,
    ...prizeImages,
  ];
  const imagesReady = useImagesReady(criticalImageUrls);

  if (isLoading) {
    return <BrandLoader />;
  }

  if (isError || !data || data.active === false || !raffle) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-muted">
            <Ticket className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-extrabold">Rifa no disponible</h1>
          <p className="mt-2 text-muted-foreground">
            Esta rifa no existe o ya no está disponible. Revisa el enlace o vuelve a la página del rifero.
          </p>
          <div className="mt-8">
            <PoweredBy />
          </div>
        </div>
      </div>
    );
  }

  // Datos listos pero faltan las imágenes clave: seguimos en la pantalla de carga.
  if (!imagesReady) {
    return <BrandLoader />;
  }

  const rifero = raffle.rifero;
  // Single-tenant: el perfil del rifero es la raíz del sitio.
  const riferoHref = '/';
  const verificarHref = '/verificar';
  const pay = raffle.paymentProfile;
  // El acceso derecho del cintillo SIEMPRE lleva a "Verificar boletos": ahí el
  // comprador ve el estado de su orden, abre su boleto digital cuando ya está
  // pagada y, si el sitio NO recibe comprobantes, envía su pago por WhatsApp
  // desde cada orden. Solo cambia la etiqueta según se suban comprobantes o no.
  const uploadAction = raffle.allowProofUpload
    ? { line1: 'Sube tu', line2: 'pago aquí', href: verificarHref, pulse: true }
    : { line1: 'Verifica tu', line2: 'boleto', href: verificarHref, pulse: true };
  const hasPayInfo = !!(pay.holderName || pay.bank || pay.clabe || pay.cardNumber || pay.concept || pay.instructions);
  // El cintillo (RaffleBrandBar) tiene altura fija; el panel de selección va justo debajo.
  const panelTopPx = BAR_TOTAL + 6;
  const heroPadTopPx = 30;

  // Precio con promociones de volumen (niveles + paquetes). El mismo cálculo lo
  // hace el backend al apartar, así que lo que ve el comprador es lo que paga.
  const pricingCfg = {
    basePrice: raffle.ticketPrice,
    tiers: raffle.pricingTiers,
    bundles: raffle.pricingBundles,
  };
  const priceResult = computeOrderPrice(selected.length, pricingCfg);
  const dealHint = nextDealHint(selected.length, pricingCfg);
  const hasDeals = raffle.pricingTiers.length > 0 || raffle.pricingBundles.length > 0;

  const onSubmitBuyer = (values: ReserveFormInput) => {
    // El WhatsApp es el contacto (también el teléfono); el nombre se arma con nombres + apellidos.
    const buyer: BuyerInput = {
      fullName: [values.nombres, values.apellidos]
        .map((s) => (s ?? '').trim().toUpperCase())
        .filter(Boolean)
        .join(' '),
      phone: values.whatsapp,
      country: values.country || 'MX',
      whatsapp: values.whatsapp,
      state: (values.state || '').toUpperCase(),
    };
    // Recuerda los datos para que la próxima vez no tenga que teclearlos de nuevo.
    rememberBuyer(buyer);
    reserveMutation.mutate(buyer);
  };

  // Abre el formulario del comprador pre-llenado con sus datos recordados.
  const openBuyer = () => {
    const saved = recallBuyer();
    if (saved) {
      const { nombres, apellidos } = splitName(saved.fullName);
      form.reset({
        country: saved.country || 'MX',
        whatsapp: saved.whatsapp || saved.phone || '',
        nombres,
        apellidos,
        state: saved.state || '',
      });
    } else {
      form.reset({ country: 'MX', whatsapp: '', nombres: '', apellidos: '', state: '' });
    }
    setBuyerOpen(true);
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copiado`);
    } catch {
      toast.error('No se pudo copiar');
    }
  };

  // Nombre y apellidos del comprador: se muestran y guardan en MAYÚSCULAS.
  const nombresField = form.register('nombres');
  const apellidosField = form.register('apellidos');
  // País del teléfono: define la lada (+52 México / +1 USA) y la lista de estados.
  const selectedCountry = form.watch('country') || 'MX';
  const statesForCountry = selectedCountry === 'US' ? US_STATES : MEXICAN_STATES;
  const countryField = form.register('country');
  const toUpperLive =
    (field: { onChange: (e: ChangeEvent<HTMLInputElement>) => void }) =>
    (e: ChangeEvent<HTMLInputElement>) => {
      e.target.value = e.target.value.toUpperCase();
      field.onChange(e);
    };

  return (
    <RiferoTheme primaryColor={rifero.primaryColor} secondaryColor={rifero.secondaryColor}>
      <div className="min-h-screen bg-background">
        {/* ── Cintillo fijo de la rifa (métodos de pago · logo → perfil · sube tu pago → verificar) ── */}
        <RaffleBrandBar
          logoUrl={rifero.logoUrl}
          publicName={rifero.publicName}
          verified={rifero.verified}
          logoScale={rifero.logoScale}
          logoGlow={rifero.logoGlow}
          riferoHref={riferoHref}
          left={{ line1: 'Métodos', line2: 'de pago', onClick: () => setPayOpen(true) }}
          right={uploadAction}
          hidden={barHidden}
        />

        {/* ── Promoción/aviso de la rifa (se configura en el panel: Promociones).
            Fija bajo el cintillo, salvo cuando el panel de apartado está abierto
            (selección activa): ahí cede el espacio y se desplaza con la página. ── */}
        {raffle.promoEnabled && raffle.promoTitle && (
          <PromoBanner
            title={raffle.promoTitle}
            subtitle={raffle.promoSubtitle}
            colorFrom={raffle.promoColorFrom}
            colorTo={raffle.promoColorTo}
            sticky={selected.length === 0}
            topPx={BAR_TOTAL}
            hidden={barHidden}
          />
        )}

        {/* ── Panel de selección flotante (se mantiene arriba al deslizar) ── */}
        {selected.length > 0 && (
          <div
            className="fixed inset-x-0 z-40 animate-fade-in border-b-4 border-[var(--rifero-primary)] bg-zinc-950/95 text-white shadow-[0_16px_30px_-6px_rgba(0,0,0,0.55)] backdrop-blur transform-gpu transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
            style={{ top: panelTopPx, transform: barHidden ? `translateY(-${BAR_TOTAL}px)` : undefined }}
          >
            <div className="mx-auto max-w-2xl px-4 py-2.5">
              <button
                type="button"
                onClick={openBuyer}
                className="attn-pulse flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--rifero-primary)] py-2.5 text-base font-black uppercase tracking-wide text-white active:scale-[0.99] sm:text-lg"
              >
                <span aria-hidden className="attn-arrow-l">→</span> Apartar{' '}
                <span aria-hidden className="attn-arrow-r">←</span>
              </button>

              <div className="mt-2 flex max-h-24 flex-wrap justify-center gap-1.5 overflow-y-auto">
                {selected.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSelected(selected.filter((x) => x !== n))}
                    className="inline-flex items-center gap-1 rounded border-2 border-[var(--rifero-primary)] px-1.5 py-0.5 text-xs font-bold tabular-nums transition-colors hover:bg-[var(--rifero-primary)]"
                    title="Quitar boleto"
                  >
                    {String(n).padStart(raffle.ticketFormat, '0')}
                    <X className="h-3 w-3 opacity-70" />
                  </button>
                ))}
              </div>

              <p className="mt-2 text-center text-sm font-extrabold uppercase tracking-wide text-[#ffe600] [text-shadow:0_1px_2px_rgba(0,0,0,0.55)]">
                {selected.length} {selected.length === 1 ? 'boleto' : 'boletos'} ·{' '}
                {priceResult.savings > 0 && (
                  <span className="font-semibold text-white/55 line-through">{formatMXN(priceResult.baseTotal)}</span>
                )}{' '}
                {formatMXN(priceResult.total)}
              </p>
              {priceResult.savings > 0 && (
                <p className="text-center text-xs font-extrabold uppercase tracking-wide text-emerald-400">
                  ¡Ahorras {formatMXN(priceResult.savings)}!
                </p>
              )}
              {giftCount > 0 && (
                <div className="mt-1.5">
                  <p className="text-center text-sm font-extrabold uppercase tracking-wide text-emerald-300 [text-shadow:0_1px_2px_rgba(0,0,0,0.55)]">
                    🎁 +{giftCount} {giftCount === 1 ? 'boleto' : 'boletos'} de regalo
                  </p>
                  {giftPreviewNumbers.length > 0 && (
                    <div className="mx-auto mt-1 flex max-h-20 max-w-md flex-wrap justify-center gap-1 overflow-y-auto">
                      {giftPreviewNumbers.map((g) => (
                        <span
                          key={g.number}
                          className="rounded border border-emerald-400/60 px-1.5 py-0.5 text-xs font-bold tabular-nums text-emerald-200"
                        >
                          {g.displayNumber}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {dealHint && (
                <p className="text-center text-xs font-semibold text-white/90">
                  Agrega {dealHint.addQty} más y {dealHint.atQty} boletos te salen en {formatMXN(dealHint.newTotal)}
                </p>
              )}
              <p className="text-center text-xs font-semibold text-[#ffe600]/90">
                Para eliminar, toca el boleto ·{' '}
                <button type="button" onClick={() => setSelected([])} className="underline hover:text-white">
                  Limpiar todo
                </button>
              </p>
            </div>
          </div>
        )}

        {/* ── Hero estilo rifa (fondo blanco) ── */}
        <header className="bg-background text-foreground">
          {/* Título a TODO LO ANCHO y pegado a la barra (sin espacio blanco), estilo referencia.
              El padding-top dinámico (ya oscuro) libra el logo que sobresale del header. */}
          <div
            className="bg-gradient-to-b from-zinc-800 to-zinc-950 text-center shadow-md"
            style={{ paddingTop: heroPadTopPx }}
          >
            <div className="mx-auto max-w-2xl px-4 pb-4">
              <h1 className="text-3xl font-black uppercase leading-[1.05] tracking-tight text-white sm:text-4xl">
                {raffle.title}
              </h1>
              {raffle.prize && (
                <p className="mt-2 text-sm font-semibold uppercase tracking-wide text-white/70 sm:text-base">
                  {raffle.prize}
                </p>
              )}
              {raffle.drawDate && (
                <p className="mt-2 text-base font-extrabold uppercase tracking-wide text-white sm:text-lg">
                  {formatDateMX(raffle.drawDate)}
                </p>
              )}
            </div>
          </div>

          {/* Llamado a la lista de boletos — flechas y texto grandes (según referencia) */}
          <div className="mt-3 flex items-center justify-center gap-3">
            <Triangle className="h-7 w-7 rotate-180 fill-[var(--rifero-primary)] text-[var(--rifero-primary)] sm:h-9 sm:w-9" />
            <span className="text-xl font-black uppercase tracking-wide sm:text-2xl">Lista de boletos abajo</span>
            <Triangle className="h-7 w-7 rotate-180 fill-[var(--rifero-primary)] text-[var(--rifero-primary)] sm:h-9 sm:w-9" />
          </div>

          {/* Imagen del premio con marco de marca */}
          <div className="mx-auto max-w-2xl px-4 pb-4 pt-3">
            <div className="overflow-hidden rounded-2xl border-4 border-[var(--rifero-primary)] shadow-[0_14px_32px_-10px_rgba(0,0,0,0.5)]">
              <PrizeGallery images={raffle.images} title={raffle.title} />
            </div>
          </div>

          {/* ── Cuenta regresiva al sorteo (debajo de la imagen, mismo fondo del hero).
              Se puede ocultar por rifa desde el panel (paso "Sorteo y pago"). ── */}
          {raffle.showCountdown && <RaffleCountdown drawDate={raffle.drawDate} status={raffle.status} />}
        </header>

        {/* ── Tabla de precios (única sección en negro). Cada fila ya refleja la
            mejor oferta (paquetes/niveles) para esa cantidad. ── */}
        <div className="bg-zinc-950 py-5 text-white">
          <div className="mx-auto max-w-2xl px-4">
            <div>
              {Array.from({ length: raffle.priceListRows ?? 10 }, (_, i) => i + 1).map((n) => {
                const row = computeOrderPrice(n, pricingCfg);
                return (
                  <div
                    key={n}
                    className="flex items-center justify-center gap-1.5 py-1.5 text-sm font-bold uppercase tracking-wide"
                  >
                    <span className="text-[var(--rifero-primary)]">{n}</span>
                    <span>{n === 1 ? 'boleto por' : 'boletos por'}</span>
                    {row.savings > 0 && (
                      <span className="text-xs font-semibold text-white/40 line-through">
                        {formatMXN(row.baseTotal)}
                      </span>
                    )}
                    <span className="tabular-nums">{formatMXN(row.total)}</span>
                  </div>
                );
              })}
            </div>

            {/* Promociones por cantidad (niveles y paquetes) */}
            {hasDeals && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {raffle.pricingBundles
                  .slice()
                  .sort((a, b) => a.qty - b.qty)
                  .map((b, i) => (
                    <span
                      key={`b${i}`}
                      className="rounded-full bg-[var(--rifero-primary)]/15 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-[var(--rifero-primary)] ring-1 ring-[var(--rifero-primary)]/30"
                    >
                      {b.qty} boletos por {formatMXN(b.price)}
                    </span>
                  ))}
                {raffle.pricingTiers
                  .slice()
                  .sort((a, b) => a.minQty - b.minQty)
                  .map((t, i) => (
                    <span
                      key={`t${i}`}
                      className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-emerald-400 ring-1 ring-emerald-500/30"
                    >
                      Desde {t.minQty}: {formatMXN(t.unitPrice)} c/u
                    </span>
                  ))}
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto max-w-2xl px-4 pt-6">
          {/* Promoción / descripción del rifero (cartel con texto enriquecido) */}
          {raffle.description &&
            (isRichHtml(raffle.description) ? (
              <div
                className="rt-content mt-6 text-base leading-snug"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(raffle.description) }}
              />
            ) : (
              <p className="mt-6 whitespace-pre-line text-center text-base font-extrabold uppercase leading-snug text-[var(--rifero-primary)]">
                {raffle.description}
              </p>
            ))}

          {/* Selector de boletos */}
          <div id="apartar" className="mt-8 scroll-mt-20">
            {/* Banner negro de instrucción */}
            <div className="-mx-4 mb-4 bg-zinc-950 px-4 py-3 text-center">
              <h2 className="text-lg font-black uppercase leading-tight tracking-wide text-white sm:text-xl">
                Haz click abajo en tu número de la suerte
              </h2>
            </div>

            {/* Atajo: escribir el número en lugar de buscarlo en la cuadrícula */}
            <button
              type="button"
              onClick={() => setGoToOpen(true)}
              className="mb-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl border-2 border-[var(--rifero-primary)] text-base font-extrabold uppercase tracking-wide text-[var(--rifero-primary)] transition-colors hover:bg-[var(--rifero-primary)]/10 active:scale-[0.99] sm:text-lg"
            >
              <Hash className="h-5 w-5" />
              Ir a mi número
            </button>

            {!ticketMap ? (
              <BrandLoader fullScreen={false} />
            ) : (
              <TicketGrid
                map={ticketMap}
                selectable
                minimal
                selected={selected}
                onSelectionChange={setSelected}
                maxSelectable={raffle.maxTicketsPerOrder ?? undefined}
                ticketPrice={raffle.ticketPrice}
                confirmLabel="Apartar boletos"
                onConfirm={openBuyer}
              />
            )}
          </div>

          {/* Ganadores */}
          {raffle.winners.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold">
                <Trophy className="h-5 w-5 text-[var(--rifero-primary)]" />
                Ganadores
              </h2>
              {raffle.winners.find((w) => w.evidenceUrl)?.evidenceUrl && (
                <video
                  src={apiAssetUrl(raffle.winners.find((w) => w.evidenceUrl)!.evidenceUrl!)}
                  controls
                  playsInline
                  className="mb-3 w-full rounded-2xl border bg-black"
                />
              )}
              <div className="grid gap-3">
                {raffle.winners
                  .slice()
                  .sort((a, b) => a.position - b.position)
                  .map((w) => (
                    <Card key={w.id}>
                      <CardContent className="flex items-center gap-3 p-4">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-amber-100 text-lg font-extrabold text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                          {w.position}°
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-muted-foreground">Boleto ganador</p>
                          <p className="text-xl font-extrabold tabular-nums">{w.ticketDisplayNumber}</p>
                          {w.prizeDescription && (
                            <p className="line-clamp-1 text-sm text-muted-foreground">{w.prizeDescription}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}

          {/* Términos (plegados: solo se cargan al pulsar, para los curiosos) */}
          {raffle.terms && (
            <details className="group mt-8 overflow-hidden rounded-2xl border bg-card shadow-sm [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3.5 font-display text-base font-extrabold tracking-tight">
                <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                <span className="flex-1">Términos y condiciones</span>
                <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="whitespace-pre-line border-t px-4 py-3.5 text-sm leading-relaxed text-muted-foreground">
                {raffle.terms}
              </p>
            </details>
          )}
        </div>

        {/* ── Barra de preguntas por WhatsApp (ancho completo) ── */}
        {rifero.whatsapp && (
          <a
            href={buildWhatsappLink(
              rifero.whatsapp,
              `¡Hola *${rifero.publicName}*! 👋\n\nTengo una pregunta sobre la rifa:\n🎟️ *${raffle.title}*`,
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-10 block bg-[var(--rifero-primary)] py-4 text-center font-extrabold uppercase leading-tight tracking-wide text-white transition-opacity hover:opacity-90"
          >
            <span className="underline">Preguntas al WhatsApp</span>
            <br />
            <span className="text-lg tabular-nums">{rifero.whatsapp}</span>
          </a>
        )}

        {/* Cierre de marca: banda a todo el ancho. Pegada a la barra de WhatsApp (sin
            hueco); si el rifero no tiene WhatsApp, conserva separación con mt-10. */}
        <BismarkCta className={rifero.whatsapp ? undefined : 'mt-10'} />
      </div>

      {/* ── Diálogo: métodos de pago del rifero ── */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display uppercase tracking-tight">Métodos de pago</DialogTitle>
            <DialogDescription>Realiza tu pago a estos datos y guarda tu comprobante para confirmarlo.</DialogDescription>
          </DialogHeader>

          {hasPayInfo ? (
            <PaymentCard pay={pay} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Este rifero aún no publicó sus métodos de pago. Contáctalo por WhatsApp para saber cómo pagar.
            </p>
          )}

          {(pay.whatsapp || rifero.whatsapp) && (
            <DialogFooter>
              <WhatsAppButton
                phone={(pay.whatsapp || rifero.whatsapp)!}
                size="lg"
                label="Preguntar por WhatsApp"
                message={`¡Hola *${rifero.publicName}*! 👋\n\nTengo una pregunta sobre los *métodos de pago* de la rifa:\n🎟️ *${raffle.title}*`}
              />
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: formulario del comprador ── */}
      <Dialog open={buyerOpen} onOpenChange={(o) => !reserveMutation.isPending && setBuyerOpen(o)}>
        <DialogContent hideClose className="overflow-hidden p-0">
          {/* Cerrar: botón rojo en la esquina (estilo referencia) */}
          <button
            type="button"
            onClick={() => setBuyerOpen(false)}
            aria-label="Cerrar"
            disabled={reserveMutation.isPending}
            className="absolute right-0 top-0 z-10 grid h-10 w-10 place-items-center rounded-bl-2xl rounded-tr-2xl bg-red-600 text-white shadow-md transition hover:bg-red-700 disabled:opacity-50"
          >
            <X className="h-5 w-5" strokeWidth={3} />
          </button>

          <div className="px-5 py-6">
            <DialogTitle className="px-7 text-center text-lg font-black uppercase leading-tight tracking-tight">
              Llena tus datos y da click en apartar
            </DialogTitle>
            <DialogDescription className="sr-only">Completa tus datos para apartar tus boletos.</DialogDescription>

            <p className="mt-2 text-center text-xl font-black uppercase" style={{ color: 'var(--rifero-primary)' }}>
              {selected.length} {selected.length === 1 ? 'boleto' : 'boletos'} por{' '}
              {priceResult.savings > 0 && (
                <span className="text-base font-bold text-muted-foreground line-through">
                  {formatMXN(priceResult.baseTotal)}
                </span>
              )}{' '}
              {formatMXN(priceResult.total)}
            </p>
            {priceResult.savings > 0 && (
              <p className="text-center text-sm font-extrabold uppercase text-emerald-600">
                ¡Ahorras {formatMXN(priceResult.savings)}!
              </p>
            )}

            <form onSubmit={form.handleSubmit(onSubmitBuyer)} className="mt-5 space-y-3">
              {/* País + WhatsApp: la bandera/lada define el +52 (México) o +1 (USA)
                  para que el comprobante llegue por WhatsApp a cualquier cliente. */}
              <div>
                <div className="flex gap-2">
                  {/* Selector de país (bandera + lada) */}
                  <div className="relative shrink-0">
                    <select
                      aria-label="País del teléfono"
                      className="h-12 appearance-none rounded-xl border-2 bg-background pl-3 pr-7 text-base font-semibold focus-visible:border-[var(--rifero-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--rifero-primary)]"
                      {...countryField}
                      onChange={(e) => {
                        void countryField.onChange(e);
                        // Limpia el estado: las listas de México y USA no coinciden.
                        form.setValue('state', '');
                      }}
                    >
                      {PHONE_COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} +{c.dialCode}
                        </option>
                      ))}
                    </select>
                    <Triangle className="pointer-events-none absolute right-2 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-180 fill-muted-foreground text-muted-foreground" />
                  </div>

                  {/* Número WhatsApp (la lada ya se eligió en el selector de la izquierda) */}
                  <div className="flex-1">
                    <Input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      placeholder="WhatsApp (10 dígitos)"
                      className="h-12 rounded-xl border-2 text-base placeholder:font-semibold placeholder:uppercase placeholder:tracking-wide focus-visible:border-[var(--rifero-primary)] focus-visible:ring-[var(--rifero-primary)]"
                      {...form.register('whatsapp')}
                    />
                  </div>
                </div>
                {form.formState.errors.whatsapp && (
                  <p className="mt-1 text-sm text-destructive">{form.formState.errors.whatsapp.message}</p>
                )}
              </div>

              {/* Nombre(s) / Apellidos / Estado (gris relleno) */}
              <div>
                <Input
                  autoComplete="given-name"
                  placeholder="Nombre(s)"
                  className="h-12 rounded-xl border-transparent bg-muted text-base uppercase placeholder:font-semibold placeholder:uppercase placeholder:tracking-wide focus-visible:border-[var(--rifero-primary)] focus-visible:bg-background focus-visible:ring-[var(--rifero-primary)]"
                  {...nombresField}
                  onChange={toUpperLive(nombresField)}
                />
                {form.formState.errors.nombres && (
                  <p className="mt-1 text-sm text-destructive">{form.formState.errors.nombres.message}</p>
                )}
              </div>

              <div>
                <Input
                  autoComplete="family-name"
                  placeholder="Apellidos (opcional)"
                  className="h-12 rounded-xl border-transparent bg-muted text-base uppercase placeholder:font-semibold placeholder:uppercase placeholder:tracking-wide focus-visible:border-[var(--rifero-primary)] focus-visible:bg-background focus-visible:ring-[var(--rifero-primary)]"
                  {...apellidosField}
                  onChange={toUpperLive(apellidosField)}
                />
                {form.formState.errors.apellidos && (
                  <p className="mt-1 text-sm text-destructive">{form.formState.errors.apellidos.message}</p>
                )}
              </div>

              <Select
                className="h-12 rounded-xl border-transparent bg-muted text-base uppercase tracking-wide focus-visible:border-[var(--rifero-primary)] focus-visible:bg-background focus-visible:ring-[var(--rifero-primary)]"
                {...form.register('state')}
              >
                <option value="">
                  {selectedCountry === 'US' ? 'Selecciona estado (USA)' : 'Selecciona estado'}
                </option>
                {statesForCountry.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>

              {/* APARTAR */}
              <Button
                type="submit"
                loading={reserveMutation.isPending}
                className="mt-2 h-14 w-full rounded-xl text-lg font-black uppercase tracking-wide text-white shadow-lg transition hover:brightness-110"
                style={{ backgroundColor: 'var(--rifero-primary)' }}
              >
                Apartar
              </Button>

              <p className="pt-1 text-center text-sm font-bold text-emerald-600">
                {raffle.allowProofUpload
                  ? '¡Al apartar podrás subir el comprobante de pago de tu boleto!'
                  : '¡Al apartar te enviaremos a WhatsApp para coordinar tu pago!'}
              </p>
            </form>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Diálogo: resumen / recibo ── */}
      <Dialog open={!!receipt} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent>
          {receipt && (
            <>
              <DialogHeader>
                <div className="mx-auto mb-2 grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <DialogTitle className="text-center">¡Boletos apartados!</DialogTitle>
                <DialogDescription className="text-center">
                  Guarda tu folio y realiza tu pago para confirmar.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {/* Folio + tiempo restante */}
                <div className="flex items-center justify-between rounded-xl bg-muted p-3">
                  <div>
                    <p className="text-[11px] text-muted-foreground">Tu folio</p>
                    <p className="text-lg font-extrabold tracking-wide">{receipt.code}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => copyText(receipt.code, 'Folio')}>
                    <Copy className="h-4 w-4" />
                    Copiar
                  </Button>
                </div>

                <ReserveTimer expiresAt={receipt.expiresAt} />

                {/* Boletos y total */}
                <div className="rounded-xl border p-3">
                  <ReceiptTickets ticketNumbers={receipt.ticketNumbers} giftNumbers={receipt.giftNumbers} />

                  <Separator className="my-3" />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Total a pagar</span>
                    <span className="text-xl font-extrabold text-[var(--rifero-primary)]">
                      {formatMXN(receipt.totalAmount)}
                    </span>
                  </div>
                </div>

                {/* Datos para tu pago: tarjetas bancarias del rifero */}
                <div>
                  <p className="mb-2 text-sm font-bold">Datos para tu pago</p>
                  <PaymentCard pay={receipt.paymentProfile} />
                </div>

                {/* Acciones */}
                <div className="grid gap-2">
                  {receipt.riferoWhatsapp && (
                    <WhatsAppButton
                      phone={receipt.riferoWhatsapp}
                      size="lg"
                      label="Enviar comprobante por WhatsApp"
                      message={waReserveMessage({
                        raffleName: raffle.title,
                        ticketNumbers: receipt.ticketNumbers.join(', '),
                        giftNumbers: receipt.giftNumbers.join(', '),
                        total: formatMXN(receipt.totalAmount),
                        orderCode: receipt.code,
                      })}
                    />
                  )}
                  {receipt.digitalTicketCode && (
                    <>
                      <Button asChild variant="outline" size="lg">
                        <a
                          href={apiAssetUrl(`/tickets/digital/${receipt.digitalTicketCode}/pdf`)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Download className="h-5 w-5" />
                          Descargar boleto digital
                        </a>
                      </Button>
                      <Button asChild variant="ghost" size="lg">
                        <a href={`/boleto/${receipt.digitalTicketCode}`} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-5 w-5" />
                          Ver mi boleto
                        </a>
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Teclado grande "Ir a mi número" (agrega a la misma selección) ── */}
      <GoToNumber
        open={goToOpen}
        onOpenChange={setGoToOpen}
        map={ticketMap}
        selected={selected}
        onSelect={setSelected}
      />

      {/* ── "Sube tu pago aquí": abre tu página de pago con tu folio ── */}
      <Dialog open={folioOpen} onOpenChange={setFolioOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sube tu pago</DialogTitle>
            <DialogDescription>
              Escribe el folio de tu compra (por ejemplo BSK-XXXX) para ver tu boleto y subir tu comprobante.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const f = folio.trim().toUpperCase();
              if (!f) return;
              setFolioOpen(false);
              navigate(`/pago/${f}`);
            }}
            className="space-y-3"
          >
            <Input
              autoFocus
              value={folio}
              onChange={(e) => setFolio(e.target.value)}
              placeholder="BSK-XXXX"
              className="h-12 text-center text-lg font-bold uppercase tracking-wide"
            />
            <DialogFooter>
              <Button type="submit" size="lg" className="w-full">
                Ver mi pago
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <SafeSeal />
    </RiferoTheme>
  );
}

