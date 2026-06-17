import { VerifiedBadge } from '@/components/brand/VerifiedBadge';
import { useHideOnScroll } from '@/hooks/useHideOnScroll';
import { cn } from '@/lib/cn';

// Sello de confianza pequeño, pegado a la parte de abajo de la pantalla:
// "Estos sorteos son seguros". Se esconde con una transición suave mientras el
// usuario se desplaza hacia abajo (despeja el contenido y evita el salto de los
// elementos fijos al colapsar la barra de URL del navegador móvil).
export function SafeSeal() {
  const hidden = useHideOnScroll();
  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(0.35rem,env(safe-area-inset-bottom))] transition-all duration-300',
        hidden && 'translate-y-full opacity-0',
      )}
    >
      <div className="relative inline-flex items-center gap-1.5 overflow-hidden rounded-full border border-blue-200 bg-white/95 px-3 py-[3px] text-[12.5px] font-bold text-blue-600 shadow-md backdrop-blur dark:border-blue-900/60 dark:bg-zinc-900/95 dark:text-blue-400">
        <VerifiedBadge size={15} />
        Estos sorteos son seguros
        {/* Destello diagonal que barre la etiqueta (mismo lenguaje que el BrandLoader). */}
        <span aria-hidden className="safe-seal-shine pointer-events-none absolute inset-0" />
      </div>
    </div>
  );
}
