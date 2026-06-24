import { Link } from 'react-router-dom';
import { VerifiedBadge } from '@/components/brand/VerifiedBadge';
import { apiAssetUrl } from '@/lib/api';
import { useHideOnScroll } from '@/hooks/useHideOnScroll';
import { cn } from '@/lib/cn';

// Barra/cintillo fijo con la marca del rifero (logo centrado que sobresale, glow,
// palomita) y dos acciones laterales configurables. Se usa en la página de la rifa
// y en "Verificar boletos" para que el comprador sienta la misma cabecera.
export const BAR_CORE = 44; // alto fijo del contenido (delgado)
export const BAR_TOTAL = BAR_CORE + 16; // + bordes (border-y-[8px])

export interface BarAction {
  line1: string;
  line2?: string;
  href?: string; // enlace interno (Link) o externo (http)
  onClick?: () => void; // o acción (botón)
  pulse?: boolean; // latido de atención periódico
}

interface Props {
  logoUrl?: string | null;
  publicName: string;
  verified?: boolean;
  logoScale?: number;
  logoGlow?: boolean;
  riferoHref: string; // a dónde lleva el logo
  left: BarAction;
  right: BarAction;
  /** Controla el auto-ocultado desde la página (para sincronizar promo/panel).
   *  Si se omite, la barra se gestiona sola con el scroll. */
  hidden?: boolean;
}

const SIDE_CLS =
  'flex-1 px-1 text-center text-xs font-extrabold uppercase leading-tight tracking-wide text-white transition-opacity hover:opacity-90 sm:text-sm';
const SIDE_STYLE = { textShadow: '0 0 5px var(--rifero-primary), 0 0 11px var(--rifero-primary)' } as const;

function SideButton({ action }: { action: BarAction }) {
  const cls = action.pulse ? `${SIDE_CLS} attn-text-pulse` : SIDE_CLS;
  const content = (
    <>
      {action.line1}
      {action.line2 && (
        <>
          <br />
          {action.line2}
        </>
      )}
    </>
  );
  if (action.href) {
    return action.href.startsWith('http') ? (
      <a href={action.href} className={cls} style={SIDE_STYLE}>
        {content}
      </a>
    ) : (
      <Link to={action.href} className={cls} style={SIDE_STYLE}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={action.onClick} className={cls} style={SIDE_STYLE}>
      {content}
    </button>
  );
}

export function RaffleBrandBar({
  logoUrl,
  publicName,
  verified,
  logoScale = 100,
  logoGlow,
  riferoHref,
  left,
  right,
  hidden: hiddenProp,
}: Props) {
  // El logo escala SOLO el ícono; la barra mantiene altura fija. El logo se centra
  // (su margen transparente sobresale invisible) y su tope es la línea de arriba.
  const barLogoPx = Math.round((40 * (logoScale ?? 100)) / 100);
  const centeredTop = Math.round((BAR_TOTAL - barLogoPx) / 2);
  const logoTopOffset = centeredTop - 8;
  const badgeTopPx = Math.max(2, -centeredTop + 2);

  // Auto-ocultado al hacer scroll: se desliza al bajar y reaparece al subir o
  // detenerse. La página puede controlarlo (prop `hidden`) para mover en sincronía
  // la promo y el panel de selección que viven justo debajo.
  const autoHidden = useHideOnScroll();
  const hidden = hiddenProp ?? autoHidden;

  return (
    <div
      className={cn(
        'sticky top-0 z-50 border-y-[8px] border-[var(--rifero-primary)] bg-zinc-950/95 text-white shadow-[0_9px_22px_-6px_rgba(0,0,0,0.5)] backdrop-blur',
        'transform-gpu transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform',
        hidden ? '-translate-y-full' : 'translate-y-0',
      )}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-3" style={{ height: BAR_CORE }}>
        <SideButton action={left} />

        {/* Logo: enlaza al perfil del rifero; sobresale sin estirar la barra */}
        <Link
          to={riferoHref}
          aria-label={`Ver perfil de ${publicName}`}
          className="relative z-10 block shrink-0"
          style={{ width: barLogoPx, height: BAR_CORE }}
        >
          <div
            className="absolute left-1/2 -translate-x-1/2"
            style={{ top: logoTopOffset, width: barLogoPx, height: barLogoPx }}
          >
            {logoUrl ? (
              <img
                src={apiAssetUrl(logoUrl)}
                alt={publicName}
                className="absolute inset-0 h-full w-full object-contain"
                style={{
                  filter: logoGlow
                    ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.35)) drop-shadow(0 0 6px color-mix(in srgb, var(--rifero-primary) 80%, transparent)) drop-shadow(0 0 14px color-mix(in srgb, var(--rifero-primary) 55%, transparent))'
                    : 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))',
                }}
              />
            ) : (
              <div
                className="absolute inset-0 grid place-items-center rounded-full border-2 border-white bg-[var(--rifero-primary)] font-black text-white"
                style={{
                  fontSize: Math.round(barLogoPx * 0.42),
                  boxShadow: logoGlow ? '0 0 4px color-mix(in srgb, var(--rifero-primary) 35%, transparent)' : undefined,
                }}
              >
                {publicName.charAt(0).toUpperCase()}
              </div>
            )}
            {verified && (
              <VerifiedBadge
                size={17}
                className="absolute drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]"
                style={{ top: badgeTopPx, right: -4 }}
              />
            )}
          </div>
        </Link>

        <SideButton action={right} />
      </div>
    </div>
  );
}
