import { useEffect, useState } from 'react';

// Precarga una lista de imágenes y avisa cuando TODAS terminaron (cargadas o con
// error). Sirve para sostener la pantalla de carga hasta que las imágenes clave
// (banner, logo, imagen de la rifa) estén listas, de modo que la página no se
// vea "armándose" con las imágenes apareciendo de a poco.
//
// Es a prueba de parpadeo: `ready` se ata a la lista actual de URLs, así que en
// cuanto cambian las URLs vuelve a `false` hasta que las nuevas cargan. Incluye
// un tope de seguridad para no quedarse esperando por una imagen rota o lenta.
export function useImagesReady(
  urls: (string | null | undefined)[],
  { timeout = 7000 }: { timeout?: number } = {},
): boolean {
  const list = urls.filter((u): u is string => typeof u === 'string' && u.length > 0);
  const key = list.join('|');
  // `readyKey` guarda la lista para la que ya terminamos; `ready` es true solo si
  // coincide con la lista actual (evita mostrar contenido un frame antes de tiempo).
  const [readyKey, setReadyKey] = useState<string | null>(null);

  useEffect(() => {
    if (list.length === 0) {
      setReadyKey(key); // key === '' → listo de inmediato (no hay nada que esperar)
      return;
    }
    let cancelled = false;
    let done = 0;
    const finishAll = () => {
      if (!cancelled) setReadyKey(key);
    };
    const bump = () => {
      done += 1;
      if (done >= list.length) finishAll();
    };
    const imgs = list.map((src) => {
      const img = new Image();
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        bump();
      };
      img.onload = settle;
      img.onerror = settle;
      img.src = src;
      // Imágenes ya en caché pueden estar completas sin disparar onload.
      if (img.complete && img.naturalWidth > 0) settle();
      return img;
    });
    const t = window.setTimeout(finishAll, timeout);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      imgs.forEach((img) => {
        img.onload = null;
        img.onerror = null;
      });
    };
    // `key` resume la lista; no dependemos de la identidad del array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, timeout]);

  return readyKey === key;
}
