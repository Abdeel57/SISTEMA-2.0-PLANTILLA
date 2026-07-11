import { useId } from 'react';
import { cn } from '@/lib/cn';

// Insignia de verificación premium: sello festoneado (rosetón) con degradado
// de profundidad, brillo superior y palomita blanca nítida. Misma API que la
// versión anterior (className, size) — se ve igual de bien de 12 a 28 px.

// Contorno del sello festoneado (rosetón de 8 lóbulos).
const SEAL =
  'M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z';

export function VerifiedBadge({
  className,
  size = 18,
  style,
}: {
  className?: string;
  size?: number;
  style?: React.CSSProperties;
}) {
  // Ids únicos por instancia para los gradientes (sin ":" — rompe url() en SVG).
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label="Verificado"
      className={cn('inline-block shrink-0 drop-shadow-[0_1px_2px_rgba(29,78,216,0.35)]', className)}
      style={style}
    >
      <title>Rifero verificado por Bismark</title>
      <defs>
        <linearGradient id={`vb-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="55%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1e40af" />
        </linearGradient>
        <radialGradient id={`vh-${uid}`} cx="0.32" cy="0.18" r="0.85">
          <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>
      {/* Sello con degradado + brillo superior (gloss) */}
      <path d={SEAL} fill={`url(#vb-${uid})`} />
      <path d={SEAL} fill={`url(#vh-${uid})`} />
      {/* Palomita */}
      <path
        d="M7.9 12.4l2.85 2.85 5.35-5.9"
        fill="none"
        stroke="#fff"
        strokeWidth="2.15"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
