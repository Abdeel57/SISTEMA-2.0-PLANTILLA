import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { Ticket, Clock, ChevronDown, ArrowRight, PlayCircle, Trophy, QrCode } from 'lucide-react';
import {
  RaffleStatus,
  formatMXN,
  formatDateMX,
  buildWhatsappLink,
  DEFAULT_FAQS,
  type PublicRaffleSummaryDTO,
} from '@bismark/shared';
import { apiAssetUrl } from '@/lib/api';
import { publicService, type PublicRiferoWinner } from '@/services/publicSite';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/misc';
import { BrandLoader } from '@/components/brand/BrandLoader';
import { RiferoTheme } from '@/components/brand/RiferoTheme';
import { VerifiedBadge } from '@/components/brand/VerifiedBadge';
import { FacebookIcon, InstagramIcon, TiktokIcon, WhatsappIcon } from '@/components/brand/SocialIcons';
import { PoweredBy } from '@/components/brand/PoweredBy';
import { BismarkCta } from '@/components/brand/BismarkCta';
import { LazyImage } from '@/components/public/LazyImage';
import { SafeSeal } from '@/components/public/SafeSeal';
import { rememberReferral } from '@/lib/referral';

interface Props {
  subdomain?: string;
  // Si se pasa, NO hace fetch público: renderiza con estos datos. Lo usa el panel
  // del rifero para verse a sí mismo (vista previa) aunque no tenga plan activo.
  previewData?: Awaited<ReturnType<typeof publicService.riferoBySubdomain>>;
}

const BRAND = 'var(--rifero-primary)';
const BRAND_SOFT = 'color-mix(in srgb, var(--rifero-primary) 10%, transparent)';

// Días que faltan para el sorteo (null si no hay fecha o ya pasó).
function daysToDraw(drawDate: string | null): number | null {
  if (!drawDate) return null;
  const ms = new Date(drawDate).getTime() - Date.now();
  if (ms <= 0) return null;
  return Math.ceil(ms / 86_400_000);
}

// ── Tarjeta de rifa (pensada para móvil: insignias sobre la imagen,
//    días al sorteo y precio tipo talón de boleto) ────────────────
function RafflePost({ raffle, basePath }: { raffle: PublicRaffleSummaryDTO; basePath: string }) {
  const cover = raffle.coverUrl ? apiAssetUrl(raffle.coverUrl) : null;
  const finished = raffle.status === RaffleStatus.FINISHED;
  const href = `${basePath}/e${raffle.eventNumber}`;
  const days = finished ? null : daysToDraw(raffle.drawDate);

  return (
    <article className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      {/* Imagen con insignias superpuestas (sin cabecera redundante) */}
      <Link to={href} className="relative block active:opacity-95">
        {cover ? (
          <div className="aspect-[16/9] w-full bg-muted">
            <LazyImage src={cover} alt={raffle.title} className="h-full w-full" width={640} height={360} />
          </div>
        ) : (
          <div
            className="grid aspect-[16/9] w-full place-items-center"
            style={{ background: 'linear-gradient(135deg, var(--rifero-primary), var(--rifero-secondary))' }}
          >
            <Ticket className="h-10 w-10 text-white/60" />
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/55 to-transparent" />

        <div className="absolute bottom-2.5 left-3 flex items-center gap-2 text-white">
          {days !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-bold backdrop-blur">
              <Clock className="h-3.5 w-3.5" />
              {days === 1 ? 'Sortea mañana' : `Faltan ${days} días`}
            </span>
          )}
          {raffle.drawDate && (
            <span className="text-[11px] font-semibold text-white/85 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
              {formatDateMX(raffle.drawDate)}
            </span>
          )}
        </div>
      </Link>

      {/* Cuerpo compacto: título + premio a la izquierda, precio a la derecha */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-lg font-extrabold uppercase leading-tight tracking-tight">
              {raffle.title}
            </h3>
            {raffle.prize && <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{raffle.prize}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Por boleto</p>
            <p className="font-ticket text-2xl font-bold leading-tight" style={{ color: BRAND }}>
              {formatMXN(raffle.ticketPrice)}
            </p>
          </div>
        </div>

        <Button
          asChild
          size="lg"
          className={`mt-3.5 w-full rounded-xl font-display font-extrabold uppercase tracking-wide text-white ${
            finished ? '' : 'attn-pulse'
          }`}
          style={{ background: BRAND }}
        >
          <Link to={href}>
            {finished ? 'Ver resultado' : 'Comprar boletos'} <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </article>
  );
}

// ── Tarjeta de ganador (oro para el 1er lugar) ──────────────────
function WinnerCard({ w }: { w: PublicRiferoWinner }) {
  const first = w.position === 1;
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 shadow-sm">
      <div
        className="grid h-12 w-12 shrink-0 place-items-center rounded-xl"
        style={
          first
            ? { background: '#fff3d6', color: '#8a5b00' }
            : { background: BRAND_SOFT, color: BRAND }
        }
      >
        {first ? (
          <Trophy className="h-5 w-5" />
        ) : (
          <span className="font-display text-lg font-extrabold">{w.position}°</span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {first ? '1er lugar · ' : `${w.position}° lugar · `}
          {w.eventLabel} · {w.raffleTitle}
        </p>
        <p
          className="mt-0.5 inline-block rounded-md border border-dashed px-2 py-0.5 font-ticket text-xl font-bold leading-tight"
          style={{
            color: first ? '#8a5b00' : BRAND,
            borderColor: first ? '#e9c478' : 'color-mix(in srgb, var(--rifero-primary) 35%, transparent)',
          }}
        >
          {w.ticketDisplayNumber}
        </p>
        {w.prizeDescription && <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{w.prizeDescription}</p>}
      </div>
      {w.evidenceUrl && (
        <a
          href={apiAssetUrl(w.evidenceUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold"
          style={{ background: BRAND_SOFT, color: BRAND }}
        >
          <PlayCircle className="h-4 w-4" /> Video
        </a>
      )}
    </div>
  );
}

// Convierte la mención "Verificar mis boletos" de una respuesta en enlace real
// (las respuestas personalizadas son texto plano).
function linkifyAnswer(text: string, verificarHref: string): React.ReactNode {
  const phrase = 'Verificar mis boletos';
  const idx = text.indexOf(phrase);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <Link to={verificarHref} className="font-semibold underline" style={{ color: BRAND }}>
        {phrase}
      </Link>
      {text.slice(idx + phrase.length)}
    </>
  );
}

// ── Pregunta frecuente (acordeón nativo, numerado) ──────────────
function Faq({ n, q, children }: { n: number; q: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl border bg-card px-4 py-3.5 shadow-sm transition-colors open:border-[var(--rifero-primary)]/40 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-3 font-display text-sm font-extrabold uppercase tracking-tight">
        <span className="font-ticket text-xs font-bold text-muted-foreground/50 transition-colors group-open:text-[var(--rifero-primary)]">
          {String(n).padStart(2, '0')}
        </span>
        <span className="flex-1">{q}</span>
        <ChevronDown
          className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180"
          style={{ color: BRAND }}
        />
      </summary>
      <div className="mt-2.5 pl-8 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </details>
  );
}

// Título de sección compacto: líneas decorativas a los lados (ahorra alto y
// se siente más editorial que el título con barra debajo). Mixto (no MAYÚSCULAS)
// en Bricolage Grotesque, con un punto en el color del rifero como acento fresco.
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3.5">
      <span
        className="h-px flex-1"
        style={{ background: 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--rifero-primary) 45%, transparent))' }}
      />
      <h2 className="shrink-0 font-display text-xl font-extrabold tracking-[-0.02em] sm:text-2xl">
        {children}
        <span className="text-[var(--rifero-primary)]">.</span>
      </h2>
      <span
        className="h-px flex-1"
        style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--rifero-primary) 45%, transparent), transparent)' }}
      />
    </div>
  );
}

export default function PublicRifero({ subdomain, previewData }: Props) {
  const params = useParams<{ slug: string }>();
  const slug = subdomain ?? params.slug ?? previewData?.rifero?.slug ?? '';
  // Single-tenant: el perfil vive en la raíz; todos los enlaces son absolutos.
  const basePath = '';
  const verificarHref = '/verificar';

  // Captura ?ref=CODE (link general del vendedor) para atribuir la venta luego.
  useEffect(() => {
    if (previewData) return;
    rememberReferral(new URLSearchParams(window.location.search).get('ref'));
  }, [previewData]);

  const query = useQuery({
    queryKey: ['public-rifero', slug],
    queryFn: () => publicService.riferoBySubdomain(slug),
    enabled: !!slug && !previewData,
  });
  const data = previewData ?? query.data;
  const isError = query.isError;

  useDocumentTitle(data?.rifero?.publicName ?? data?.publicName);

  if (!previewData && query.isLoading) {
    return <BrandLoader />;
  }

  if (isError || !data || data.active === false || !data.rifero) {
    return (
      <div className="grid min-h-screen place-items-center bg-background px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-muted">
            <Clock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-extrabold">Esta página aún no está activa</h1>
          <p className="mt-2 text-muted-foreground">
            {data?.publicName ? `${data.publicName} ` : ''}
            está preparando sus rifas. Vuelve pronto para participar.
          </p>
          <div className="mt-8">
            <PoweredBy />
          </div>
        </div>
      </div>
    );
  }

  const rifero = data.rifero;
  const winners = data.winners ?? [];
  const cover = rifero.coverUrl ? apiAssetUrl(rifero.coverUrl) : null;
  const logo = rifero.logoUrl ? apiAssetUrl(rifero.logoUrl) : null;
  // Foto de perfil (estilo FB), ajustable desde Apariencia, con tope para no romper el layout.
  const photoPx = Math.min(Math.round((120 * (rifero.logoScale ?? 100)) / 100), 168);

  const active = rifero.raffles.filter((r) => r.status === RaffleStatus.PUBLISHED);
  const finished = rifero.raffles.filter((r) => r.status === RaffleStatus.FINISHED);
  // FAQ personalizadas del rifero; si no ha guardado las suyas, las de fábrica.
  const faqs = rifero.faqs && rifero.faqs.length > 0 ? rifero.faqs : DEFAULT_FAQS;

  return (
    <RiferoTheme primaryColor={rifero.primaryColor} secondaryColor={rifero.secondaryColor}>
      <div className="min-h-screen bg-muted/40">
        {/* ── Portada (banner) ── */}
        <div className="relative h-44 w-full overflow-hidden sm:h-56 lg:h-64">
          {cover ? (
            <LazyImage src={cover} alt="" className="h-full w-full" loading="eager" />
          ) : (
            <div
              className="relative h-full w-full"
              style={{ background: 'linear-gradient(135deg, var(--rifero-primary), var(--rifero-secondary))' }}
            >
              {/* Textura para que la portada sin imagen no se vea vacía */}
              <div className="grain absolute inset-0 opacity-25" />
              <div
                className="absolute inset-0 opacity-[0.12]"
                style={{
                  backgroundImage: 'radial-gradient(circle, #fff 1.2px, transparent 1.2px)',
                  backgroundSize: '26px 26px',
                }}
              />
              <div className="absolute -top-24 left-1/2 h-80 w-[44rem] -translate-x-1/2 rounded-full bg-white/15 blur-[110px]" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-1.5" style={{ background: BRAND }} />
        </div>

        <div className="mx-auto max-w-2xl px-4 pb-14 lg:max-w-5xl">
          {/* ── Encabezado de perfil: centrado en móvil, tarjeta horizontal en desktop ── */}
          {/* relative z-10: la tarjeta sube sobre la portada y debe pintar encima de sus overlays absolutos */}
          <div className="relative z-10 lg:-mt-12 lg:rounded-3xl lg:border lg:bg-card lg:px-8 lg:pb-6 lg:shadow-xl">
            <div className="flex flex-col items-center lg:flex-row lg:items-end lg:gap-6">
              {/* Foto de perfil (sobre la portada / sobre la tarjeta) */}
              <div
                className="flex shrink-0 justify-center"
                style={{ ['--av-mt' as string]: `${-photoPx / 2}px` }}
              >
                <div className="relative mt-[var(--av-mt)] lg:mt-[var(--av-mt)]">
                  <div
                    className="overflow-hidden rounded-full border-4 border-background bg-card shadow-xl"
                    style={{
                      height: photoPx,
                      width: photoPx,
                      boxShadow: rifero.logoGlow
                        ? '0 0 0 4px hsl(var(--background)), 0 0 14px color-mix(in srgb, var(--rifero-primary) 35%, transparent), 0 12px 28px rgba(0,0,0,0.2)'
                        : undefined,
                    }}
                  >
                    {logo ? (
                      <img src={logo} alt={rifero.publicName} className="h-full w-full object-contain" />
                    ) : (
                      <div
                        className="grid h-full w-full place-items-center font-black text-white"
                        style={{ background: BRAND, fontSize: Math.round(photoPx * 0.38) }}
                      >
                        {rifero.publicName.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  {rifero.verified && (
                    <VerifiedBadge size={30} className="absolute bottom-0.5 right-0.5 drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]" />
                  )}
                </div>
              </div>

              {/* Nombre + bio + redes */}
              <div className="mt-3 min-w-0 flex-1 text-center lg:mt-0 lg:pb-1 lg:text-left">
                <h1 className="flex items-center justify-center gap-1.5 font-display text-2xl font-extrabold tracking-tight sm:text-3xl lg:justify-start">
                  {rifero.publicName}
                  {rifero.verified && <VerifiedBadge size={22} />}
                </h1>
                {rifero.description && (
                  <p className="mx-auto mt-2 max-w-md whitespace-pre-line text-sm leading-relaxed text-muted-foreground lg:mx-0">
                    {rifero.description}
                  </p>
                )}

                {/* Insignias del rifero (stats compactas; oculta las que van en 0) */}
                {(() => {
                  const chips = [
                    { value: active.length, label: active.length === 1 ? 'disponible' : 'disponibles' },
                    { value: finished.length, label: finished.length === 1 ? 'sorteo realizado' : 'sorteos realizados' },
                    { value: winners.length, label: winners.length === 1 ? 'ganador' : 'ganadores' },
                  ].filter((c) => c.value > 0);
                  if (chips.length === 0) return null;
                  return (
                    <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 lg:justify-start">
                      {chips.map((c) => (
                        <span
                          key={c.label}
                          className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-[11px] font-semibold text-muted-foreground shadow-sm"
                        >
                          <strong className="font-ticket text-xs font-bold" style={{ color: BRAND }}>
                            {c.value}
                          </strong>
                          {c.label}
                        </span>
                      ))}
                    </div>
                  );
                })()}

                {/* Redes (logos oficiales) */}
                <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2.5 lg:justify-start">
                  {rifero.facebook && (
                    <a
                      href={rifero.facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Facebook"
                      className="grid h-11 w-11 place-items-center rounded-full border bg-card text-[#1877F2] shadow-sm transition-transform hover:-translate-y-0.5"
                    >
                      <FacebookIcon className="h-[22px] w-[22px]" />
                    </a>
                  )}
                  {rifero.instagram && (
                    <a
                      href={rifero.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Instagram"
                      className="grid h-11 w-11 place-items-center rounded-full border bg-card shadow-sm transition-transform hover:-translate-y-0.5"
                    >
                      <InstagramIcon className="h-[22px] w-[22px]" />
                    </a>
                  )}
                  {rifero.tiktok && (
                    <a
                      href={rifero.tiktok}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="TikTok"
                      className="grid h-11 w-11 place-items-center rounded-full border bg-card text-foreground shadow-sm transition-transform hover:-translate-y-0.5"
                    >
                      <TiktokIcon className="h-[21px] w-[21px]" />
                    </a>
                  )}
                  {rifero.whatsapp && (
                    <a
                      href={buildWhatsappLink(
                        rifero.whatsapp,
                        `Hola ${rifero.publicName}, vi tu página de rifas y tengo una pregunta.`,
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-11 items-center gap-2 rounded-full bg-[#25D366] px-4 font-bold text-white shadow-sm transition-transform hover:-translate-y-0.5 lg:hidden"
                    >
                      <WhatsappIcon className="h-5 w-5" />
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>

              {/* Acciones (solo desktop): CTA primario + WhatsApp */}
              <div className="hidden shrink-0 flex-col items-stretch gap-2.5 lg:flex lg:pb-1">
                {active.length > 0 && (
                  <Button
                    asChild
                    size="lg"
                    className="rounded-full font-display font-extrabold uppercase tracking-wide text-white"
                    style={{ background: BRAND }}
                  >
                    <a href="#rifas">
                      Ver rifas disponibles <ChevronDown className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {rifero.whatsapp && (
                  <a
                    href={buildWhatsappLink(
                      rifero.whatsapp,
                      `Hola ${rifero.publicName}, vi tu página de rifas y tengo una pregunta.`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 font-bold text-white shadow-sm transition-transform hover:-translate-y-0.5"
                  >
                    <WhatsappIcon className="h-5 w-5" />
                    WhatsApp
                  </a>
                )}
              </div>
            </div>

          </div>

          {/* ── Rifas disponibles (feed) ── */}
          <section id="rifas" className="mt-5 scroll-mt-6 lg:mt-10">
            <SectionTitle>Rifas disponibles</SectionTitle>
            {active.length > 0 ? (
              <div className={active.length > 1 ? 'grid gap-4 lg:grid-cols-2 lg:gap-5' : 'mx-auto grid max-w-xl gap-4'}>
                {active.map((r) => (
                  <RafflePost key={r.id} raffle={r} basePath={basePath} />
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Ticket className="h-10 w-10" />}
                title="Aún no hay rifas disponibles"
                description="Este rifero todavía no publica rifas. Síguelo en redes para enterarte primero."
              />
            )}
          </section>

          {/* ── Sorteos realizados (rifas finalizadas: ver resultado) ── */}
          {finished.length > 0 && (
            <section className="mt-10 lg:mt-14">
              <SectionTitle>Sorteos realizados</SectionTitle>
              <div className={finished.length > 1 ? 'grid gap-4 lg:grid-cols-2 lg:gap-5' : 'mx-auto grid max-w-xl gap-4'}>
                {finished.map((r) => (
                  <RafflePost key={r.id} raffle={r} basePath={basePath} />
                ))}
              </div>
            </section>
          )}

          {/* ── Ganadores ── */}
          {winners.length > 0 && (
            <section className="mt-10 lg:mt-14">
              <SectionTitle>Ganadores</SectionTitle>
              <div className={winners.length > 1 ? 'grid gap-3 lg:grid-cols-2' : 'mx-auto grid max-w-xl gap-3'}>
                {winners.map((w) => (
                  <WinnerCard key={w.id} w={w} />
                ))}
              </div>
            </section>
          )}

          {/* ── Preguntas frecuentes (personalizables desde el admin) ── */}
          {faqs.length > 0 && (
            <section className="mx-auto mt-10 max-w-3xl lg:mt-14">
              <SectionTitle>Preguntas frecuentes</SectionTitle>
              <div className="grid gap-2.5">
                {faqs.map((f, i) => (
                  <Faq key={`${i}-${f.q}`} n={i + 1} q={f.q}>
                    {linkifyAnswer(f.a, verificarHref)}
                  </Faq>
                ))}
              </div>
            </section>
          )}

          {/* ── Cierre de confianza ── */}
          <footer className="mx-auto mt-14 max-w-3xl">
            <div className="relative overflow-hidden rounded-2xl border bg-card px-6 py-7 text-center shadow-sm sm:px-10">
              {/* Hairline superior en el color del rifero (mismo lenguaje que los títulos de sección) */}
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-[3px]"
                style={{
                  background:
                    'linear-gradient(90deg, transparent, color-mix(in srgb, var(--rifero-primary) 70%, transparent), transparent)',
                }}
              />

              <div
                className="mx-auto grid h-12 w-12 place-items-center rounded-xl"
                style={{ background: BRAND_SOFT, color: BRAND }}
              >
                <QrCode className="h-6 w-6" />
              </div>

              <h2 className="mt-3 font-display text-lg font-extrabold tracking-[-0.02em] sm:text-xl">
                Compra con confianza
                <span className="text-[var(--rifero-primary)]">.</span>
              </h2>
              <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                Cada boleto pagado genera un boleto digital con código QR para validarlo el día del sorteo.
              </p>

              <Button
                asChild
                size="lg"
                className="mt-4 rounded-full font-display font-extrabold uppercase tracking-wide text-white"
                style={{ background: BRAND }}
              >
                <Link to={verificarHref}>
                  Verificar mis boletos <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              {rifero.verified && (
                <p className="mt-4 flex items-center justify-center gap-1.5 text-xs font-bold" style={{ color: BRAND }}>
                  <VerifiedBadge size={15} /> Rifero verificado
                </p>
              )}
            </div>
          </footer>
        </div>

        {/* ── Cierre de marca: banda a todo el ancho que desconecta de la rifa ── */}
        <BismarkCta />
      </div>
      <SafeSeal />
    </RiferoTheme>
  );
}

