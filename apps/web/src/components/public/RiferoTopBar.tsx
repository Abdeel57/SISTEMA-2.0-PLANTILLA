import { apiAssetUrl } from '@/lib/api';
import { VerifiedBadge } from '@/components/brand/VerifiedBadge';
import { useHideOnScroll } from '@/hooks/useHideOnScroll';
import { cn } from '@/lib/cn';

// Barra superior con la marca del rifero (fondo oscuro + bordes del color del
// rifero, logo centrado) y los dos accesos: "Métodos de pago" y "Sube tu pago
// aquí". Los `href` anclan a las secciones (#metodos-de-pago / #sube-tu-pago).
// Los colores vienen de las variables CSS que aplica <RiferoTheme>.
export function RiferoTopBar({
  logoUrl,
  publicName,
  verified = false,
  logoGlow = false,
  leftHref = '#metodos-de-pago',
  rightHref = '#sube-tu-pago',
  // Etiqueta del acceso derecho. Cuando el sitio NO recibe comprobantes, la página
  // pasa "Envía tu / pago" + un enlace de WhatsApp (rightHref http externo).
  rightLine1 = 'Sube tu',
  rightLine2 = 'pago aquí',
}: {
  logoUrl: string | null;
  publicName: string;
  verified?: boolean;
  logoGlow?: boolean;
  leftHref?: string;
  rightHref?: string;
  rightLine1?: string;
  rightLine2?: string;
}) {
  const rightExternal = rightHref.startsWith('http');
  const LOGO = 48;
  const hidden = useHideOnScroll();
  const linkClass =
    'flex-1 px-1 text-center text-xs font-extrabold uppercase leading-tight tracking-wide text-white transition-opacity hover:opacity-90 sm:text-sm';
  const glow = { textShadow: '0 0 5px var(--rifero-primary), 0 0 11px var(--rifero-primary)' };

  return (
    <div
      className={cn(
        'sticky top-0 z-50 border-y-[8px] border-[var(--rifero-primary,#1A4DFF)] bg-zinc-950/95 text-white backdrop-blur safe-top',
        'transform-gpu transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform',
        hidden ? '-translate-y-full' : 'translate-y-0',
      )}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-3" style={{ height: 56 }}>
        <a href={leftHref} className={linkClass} style={glow}>
          Métodos
          <br />
          de pago
        </a>

        <div className="relative shrink-0" style={{ width: LOGO, height: LOGO }}>
          {logoUrl ? (
            <img
              src={apiAssetUrl(logoUrl)}
              alt={publicName}
              className="h-full w-full object-contain"
              style={{
                filter: logoGlow
                  ? 'drop-shadow(0 1px 2px rgba(0,0,0,0.35)) drop-shadow(0 0 6px color-mix(in srgb, var(--rifero-primary) 80%, transparent)) drop-shadow(0 0 14px color-mix(in srgb, var(--rifero-primary) 55%, transparent))'
                  : 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))',
              }}
            />
          ) : (
            <div className="grid h-full w-full place-items-center rounded-full border-2 border-white bg-[var(--rifero-primary,#1A4DFF)] text-xl font-black text-white">
              {publicName.charAt(0).toUpperCase()}
            </div>
          )}
          {verified && (
            <VerifiedBadge size={17} className="absolute -right-1 -top-1 drop-shadow-[0_1px_4px_rgba(0,0,0,0.45)]" />
          )}
        </div>

        <a
          href={rightHref}
          {...(rightExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className={linkClass}
          style={glow}
        >
          {rightLine1}
          <br />
          {rightLine2}
        </a>
      </div>
    </div>
  );
}
