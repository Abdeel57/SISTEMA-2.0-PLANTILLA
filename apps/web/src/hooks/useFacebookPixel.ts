import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { publicService } from '@/services/publicSite';
import { initPixel, pixelTrack } from '@/lib/pixel';

const SITE = '_'; // alias single-tenant: "el rifero de este sitio"

// El pixel es del EMBUDO DEL COMPRADOR: no debe cargar en el panel ni en el login.
function isAdminPath(pathname: string): boolean {
  return pathname === '/login' || pathname === '/admin' || pathname.startsWith('/admin/');
}

// Carga el pixel de Facebook del rifero (si configuró uno en el panel) y reporta
// PageView en cada cambio de ruta pública. Como es una SPA, la navegación no
// recarga el documento: sin esto Meta solo vería la primera pantalla.
//
// Reutiliza la misma consulta del perfil público que usePwaBranding (misma
// queryKey), así que no genera peticiones extra.
export function useFacebookPixel(): void {
  const { pathname } = useLocation();
  const isAdmin = isAdminPath(pathname);

  const { data } = useQuery({
    queryKey: ['public-rifero', SITE],
    queryFn: () => publicService.riferoBySubdomain(SITE),
    staleTime: 5 * 60_000,
    enabled: !isAdmin,
  });
  const pixelId = data?.rifero?.facebookPixelId ?? null;

  useEffect(() => {
    if (isAdmin || !pixelId) return;
    initPixel(pixelId);
    pixelTrack('PageView');
  }, [isAdmin, pixelId, pathname]);
}
