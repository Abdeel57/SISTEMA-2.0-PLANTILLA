import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  src: string;
  alt: string;
  /** Clases para el contenedor (debe fijar tamaño/aspecto para evitar saltos). */
  className?: string;
  /** Clases para la imagen. */
  imgClassName?: string;
  /** Ancho/alto intrínsecos: ayudan al navegador a reservar el espacio. */
  width?: number;
  height?: number;
  /** `eager` para imágenes visibles de inmediato (portada); `lazy` por defecto. */
  loading?: 'lazy' | 'eager';
}

/**
 * Imagen con carga diferida y placeholder difuminado (blur-up).
 *
 * - Reserva el espacio (contenedor con aspecto fijo) para evitar saltos de
 *   layout cuando la imagen llega: importante en móvil y para no marear a una
 *   persona mayor con la página "brincando".
 * - Muestra un fondo suave mientras carga y hace fade-in al terminar.
 * - No se usa en TicketGrid (zona caliente de otro chat).
 */
export function LazyImage({
  src,
  alt,
  className,
  imgClassName,
  width,
  height,
  loading = 'lazy',
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {/* Placeholder animado mientras la imagen no ha cargado */}
      {!loaded && !errored && <div className="absolute inset-0 animate-pulse bg-muted" aria-hidden />}
      {/* Si la imagen no carga (404), mostramos un marcador VISIBLE en vez de dejar
          el hueco transparente —que confunde: "parece que está pero no se ve". */}
      {errored ? (
        <div className="absolute inset-0 grid place-items-center bg-muted text-muted-foreground" aria-hidden>
          <ImageOff className="h-7 w-7 opacity-40" />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          loading={loading}
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={cn(
            'h-full w-full object-cover transition-opacity duration-500',
            loaded ? 'opacity-100' : 'opacity-0',
            imgClassName,
          )}
        />
      )}
    </div>
  );
}
