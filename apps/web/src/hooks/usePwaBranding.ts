import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { publicService } from '@/services/publicSite';
import { apiAssetUrl } from '@/lib/api';

const SITE = '_'; // alias single-tenant: "el rifero de este sitio"
const ADMIN_TITLE = 'Sortea | ADMIN';

// El administrador (/admin, /login) es SIEMPRE la marca Sortea, nunca la del
// rifero: el panel es del producto (Sortea), no del organizador.
function isAdminPath(pathname: string): boolean {
  return pathname === '/login' || pathname === '/admin' || pathname.startsWith('/admin/');
}

// Reemplaza los <link rel="icon"> por uno solo (favicon de la pestaña).
function setIcon(href: string): void {
  const head = document.head;
  head.querySelectorAll("link[rel='icon'], link[rel='shortcut icon']").forEach((l) => l.remove());
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = href;
  head.appendChild(link);
}

// Ícono usado por iOS al "Agregar a inicio".
function setAppleTouchIcon(href: string): void {
  const apple = document.head.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
  if (apple) apple.href = href;
}

// Manifest activo (decide nombre, ícono y start_url de la PWA instalada/instalable).
function setManifest(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>("link[rel='manifest']");
  if (!link) {
    link = document.createElement('link');
    link.rel = 'manifest';
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
}

// Nombre que iOS usa al "Agregar a inicio".
function setAppleTitle(title: string): void {
  const meta = document.head.querySelector<HTMLMetaElement>("meta[name='apple-mobile-web-app-title']");
  if (meta) meta.content = title;
}

// Aplica la marca de la PWA (favicon de la pestaña, ícono de A2HS, nombre y
// manifest) según la sección, y la reafirma al navegar dentro de la SPA:
//   - Administrador (/admin, /login): SIEMPRE Sortea. Logo de Sortea (nunca el
//     del rifero), nombre "Sortea | ADMIN" y manifest que abre directo en /admin.
//   - Público: la identidad del rifero del sitio (su logo como favicon y su nombre).
// En producción el backend ya inyecta lo correcto en el HTML inicial (ver
// site-html.ts); esto lo garantiza también en desarrollo y tras navegar.
export function usePwaBranding(): void {
  const { pathname } = useLocation();
  const isAdmin = isAdminPath(pathname);

  const { data } = useQuery({
    queryKey: ['public-rifero', SITE],
    queryFn: () => publicService.riferoBySubdomain(SITE),
    staleTime: 5 * 60_000,
    enabled: !isAdmin, // en el admin no necesitamos el perfil del rifero
  });
  const logoUrl = data?.rifero?.logoUrl ?? null;
  const publicName = data?.rifero?.publicName ?? null;

  useEffect(() => {
    if (isAdmin) {
      setManifest('/admin.webmanifest');
      setAppleTitle(ADMIN_TITLE);
      setIcon('/favicon.svg');
      setAppleTouchIcon('/apple-touch-icon.png');
      return;
    }
    setManifest('/manifest.webmanifest');
    if (publicName) setAppleTitle(publicName);
    if (logoUrl) {
      const href = apiAssetUrl(logoUrl);
      setIcon(href);
      setAppleTouchIcon(href);
    }
  }, [isAdmin, logoUrl, publicName]);
}
