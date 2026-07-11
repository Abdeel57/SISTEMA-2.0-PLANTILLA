import { cn } from '@/lib/cn';
import logoUrl from '@/assets/bismark-logo.png';

// Monograma oficial de Bismark ("BISMARK LOGO PERFECTO"). El archivo es negro
// sobre transparente, así que:
//   variant="black" → tal cual (para superficies claras).
//   variant="white" → invertido a blanco (para superficies oscuras).
//   variant="auto"  → negro en tema claro, blanco en tema oscuro (dark:invert).
export function LogoMark({
  className,
  variant = 'auto',
}: {
  className?: string;
  variant?: 'black' | 'white' | 'auto';
}) {
  return (
    <img
      src={logoUrl}
      alt="Bismark"
      draggable={false}
      className={cn(
        'block h-8 w-8 select-none object-contain',
        variant === 'white' && 'invert',
        variant === 'auto' && 'dark:invert',
        className,
      )}
    />
  );
}
