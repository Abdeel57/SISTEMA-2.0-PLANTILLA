import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import logoColor from '@/assets/sortea-logo.png';
import logoWhite from '@/assets/sortea-icon-white.png';

// Recorta la capa del destello a la silueta del monograma (PNG transparente).
function maskFor(url: string): CSSProperties {
  return {
    maskImage: `url(${url})`,
    maskSize: 'contain',
    maskRepeat: 'no-repeat',
    maskPosition: 'center',
    WebkitMaskImage: `url(${url})`,
    WebkitMaskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
  };
}

// Pantalla de carga de marca: el ícono de Sortea quieto, barrido por un destello
// diagonal con los colores del degradado (azul → blanco → magenta). Sin texto.
//   fullScreen (default): overlay fijo sobre tinta — el ícono BLANCO respira
//     sobre un aura azul/magenta pulsante. Cargas de página completas.
//   fullScreen=false: versión compacta sobre fondo claro (ej. boletera); usa el
//     ícono a color para leerse bien sin el fondo oscuro.
export function BrandLoader({
  fullScreen = true,
  className,
}: {
  fullScreen?: boolean;
  className?: string;
}) {
  const logoUrl = fullScreen ? logoWhite : logoColor;

  return (
    <div
      role="status"
      aria-label="Cargando"
      className={cn(
        fullScreen
          ? 'brand-loader-in fixed inset-0 z-50 grid place-items-center bg-[#070b18]'
          : 'grid place-items-center py-14',
        className,
      )}
      style={
        fullScreen
          ? { backgroundImage: 'radial-gradient(620px circle at 50% 50%, rgba(34,53,249,0.16), transparent 65%)' }
          : undefined
      }
    >
      <div className={cn('relative grid place-items-center', fullScreen ? 'h-24 w-24' : 'h-12 w-12')}>
        {/* Aura de marca: halo azul→magenta que late detrás del ícono. */}
        {fullScreen && <div aria-hidden className="brand-loader-aura absolute -inset-7 rounded-full" />}
        <img
          src={logoUrl}
          alt=""
          draggable={false}
          className={cn(
            'relative h-full w-full select-none object-contain',
            fullScreen ? 'brand-loader-breathe opacity-95' : 'opacity-90',
          )}
        />
        {/* Destello diagonal recortado a la silueta del monograma. */}
        <div aria-hidden className="brand-loader-shine absolute inset-0" style={maskFor(logoUrl)} />
      </div>
    </div>
  );
}
