import { cn } from '@/lib/cn';
import { LogoMark } from './LogoMark';

export function Logo({ className, withText = true }: { className?: string; withText?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2 font-display font-extrabold tracking-tight', className)}>
      <LogoMark className="h-8 w-8" />
      {withText && <span className="text-xl">Bismark</span>}
    </span>
  );
}
