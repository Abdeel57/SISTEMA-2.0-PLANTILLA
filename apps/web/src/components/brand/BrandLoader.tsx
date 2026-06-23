import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import logoUrl from '@/assets/sortea-logo.png';

// Recorta la capa del destello a la silueta del monograma (PNG transparente).
const logoMask: CSSProperties = {
  maskImage: `url(${logoUrl})`,
  maskSize: 'contain',
  maskRepeat: 'no-repeat',
  maskPosition: 'center',
  WebkitMaskImage: `url(${logoUrl})`,
  WebkitMaskSize: 'contain',
  WebkitMaskRepeat: 'no-repeat',
  WebkitMaskPosition: 'center',
};

// Pantalla de carga de marca: el ícono de Sortea quieto, barrido por un
// destello diagonal. Sin texto.
//   fullScreen (default): overlay fijo con fondo tinta — cargas de página.
//   fullScreen=false: versión compacta para secciones internas (ej. boletera).
export function BrandLoader({
  fullScreen = true,
  className,
}: {
  fullScreen?: boolean;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="Cargando"
      className={cn(
        fullScreen
          ? 'fixed inset-0 z-50 grid place-items-center bg-[#070b18]'
          : 'grid place-items-center py-14',
        className,
      )}
      style={
        fullScreen
          ? { backgroundImage: 'radial-gradient(560px circle at 50% 50%, rgba(26,77,255,0.12), transparent 65%)' }
          : undefined
      }
    >
      <div className={cn('relative', fullScreen ? 'h-20 w-20' : 'h-12 w-12')}>
        <img
          src={logoUrl}
          alt=""
          draggable={false}
          className="h-full w-full select-none object-contain opacity-90"
        />
        <div aria-hidden className="brand-loader-shine absolute inset-0" style={logoMask} />
      </div>
    </div>
  );
}
