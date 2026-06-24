import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { publicService } from '@/services/publicSite';
import { applyTheme } from '@/store/theme';

const SITE = '_'; // alias single-tenant: "el rifero de este sitio"

// Decide y aplica el tema en cada navegación de la SPA (fuente única):
//   - Administrador (/admin, /login) → siempre claro.
//   - Páginas públicas → lo elige el rifero (publicDarkMode), por defecto claro.
// En producción el backend ya inyecta la clase `dark` en el HTML inicial de las
// páginas públicas, así que aquí solo reafirmamos al navegar (y en desarrollo,
// donde no hay HTML inyectado). Comparte la query con usePwaBranding (mismo key).
export function ThemeController(): null {
  const { pathname } = useLocation();
  const isAdmin = pathname === '/login' || pathname === '/admin' || pathname.startsWith('/admin/');
  const { data } = useQuery({
    queryKey: ['public-rifero', SITE],
    queryFn: () => publicService.riferoBySubdomain(SITE),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (isAdmin) {
      applyTheme(false);
      return;
    }
    // En público: hasta no conocer el ajuste del rifero, NO tocamos la clase que
    // ya puso el backend (evita el parpadeo claro→oscuro en sitios en oscuro).
    if (data) applyTheme(!!data.rifero?.publicDarkMode);
  }, [isAdmin, data]);

  return null;
}
