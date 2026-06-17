import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { publicService } from '@/services/publicSite';
import { apiAssetUrl } from '@/lib/api';

const SITE = '_'; // alias single-tenant: "el rifero de este sitio"

// Pone el logo del rifero como favicon de la pestaña (reemplaza la "B" de
// Bismark). En producción el backend ya inyecta el favicon en el HTML inicial;
// este hook lo garantiza también en desarrollo y tras navegar en la SPA.
function setFavicon(href: string): void {
  const head = document.head;
  head
    .querySelectorAll("link[rel='icon'], link[rel='shortcut icon']")
    .forEach((l) => l.parentElement?.removeChild(l));
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = href;
  head.appendChild(link);
  const apple = head.querySelector("link[rel='apple-touch-icon']") as HTMLLinkElement | null;
  if (apple) apple.href = href;
}

export function useSiteFavicon(): void {
  const { data } = useQuery({
    queryKey: ['public-rifero', SITE],
    queryFn: () => publicService.riferoBySubdomain(SITE),
    staleTime: 5 * 60_000,
  });
  const logoUrl = data?.rifero?.logoUrl ?? null;
  useEffect(() => {
    if (logoUrl) setFavicon(apiAssetUrl(logoUrl));
  }, [logoUrl]);
}
