import { cn } from '@/lib/cn';
import logoUrl from '@/assets/sortea-logo.png';

// Ícono oficial de Sortea (la "S" de boletos a color). Es un PNG a todo color
// sobre transparente, así que se usa tal cual sobre fondos claros y oscuros
// (sin invertir). La prop `variant` se conserva por compatibilidad con los
// llamados existentes, pero ya no altera el color del ícono.
export function LogoMark({
  className,
}: {
  className?: string;
  variant?: 'black' | 'white' | 'auto';
}) {
  return (
    <img
      src={logoUrl}
      alt="Sortea"
      draggable={false}
      className={cn('block h-8 w-8 select-none object-contain', className)}
    />
  );
}
