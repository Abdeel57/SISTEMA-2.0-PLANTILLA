import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { publicService } from '@/services/publicSite';
import { useSiteStore } from '@/store/site';

const SITE = '_'; // alias single-tenant: "el rifero de este sitio"

function isAdminPath(pathname: string): boolean {
  return pathname === '/login' || pathname === '/admin' || pathname.startsWith('/admin/');
}

// Mantiene el idioma y la moneda del sitio sincronizados con lo que el rifero
// configuró ("Modo USA"). En producción el backend ya los inyecta en el HTML y el
// store arranca con el valor correcto; esto los corrige en desarrollo y cuando el
// rifero los cambia sin recargar el documento.
//
// Solo en páginas públicas: el panel del rifero se queda en español.
export function useSiteConfig(): void {
  const { pathname } = useLocation();
  const isAdmin = isAdminPath(pathname);
  const setSite = useSiteStore((s) => s.setSite);

  const { data } = useQuery({
    queryKey: ['public-rifero', SITE],
    queryFn: () => publicService.riferoBySubdomain(SITE),
    staleTime: 5 * 60_000,
    enabled: !isAdmin,
  });

  const locale = data?.rifero?.locale ?? null;
  const currency = data?.rifero?.currency ?? null;

  useEffect(() => {
    if (isAdmin) return;
    setSite({ locale, currency });
    if (locale && typeof document !== 'undefined') {
      document.documentElement.setAttribute('lang', locale);
    }
  }, [isAdmin, locale, currency, setSite]);
}
