import { useEffect, useRef, Suspense } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Eye,
  Home,
  Receipt,
  Ticket,
  Menu,
  Palette,
  User,
  Users,
  CreditCard,
  FileBarChart,
  Settings,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { PageLoader } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { useNotificationsSummary } from '@/lib/pwa/useNotificationsSummary';
import { useAuthStore } from '@/store/auth';
import { LogoMark } from '@/components/brand/LogoMark';

function sectionTitle(pathname: string): string {
  if (pathname.startsWith('/admin/ordenes')) return 'Órdenes';
  if (pathname.startsWith('/admin/rifas/nueva')) return 'Nueva rifa';
  if (/^\/admin\/rifas\/[^/]+\/editar/.test(pathname)) return 'Editar rifa';
  if (/^\/admin\/rifas\/[^/]+\/boletos/.test(pathname)) return 'Boletos';
  if (/^\/admin\/rifas\/[^/]+\/sorteo/.test(pathname)) return 'Sorteo';
  if (/^\/admin\/rifas\/[^/]+\/promociones/.test(pathname)) return 'Promociones';
  if (pathname.startsWith('/admin/rifas')) return 'Rifas';
  if (pathname.startsWith('/admin/diseno')) return 'Apariencia';
  if (pathname.startsWith('/admin/perfil')) return 'Perfil';
  if (pathname.startsWith('/admin/pagos')) return 'Datos de pago';
  if (pathname.startsWith('/admin/reportes')) return 'Reportes';
  if (pathname.startsWith('/admin/configuracion')) return 'Ajustes';
  if (pathname.startsWith('/admin/usuarios')) return 'Usuarios y Roles';
  if (pathname.startsWith('/admin/mas')) return 'Más';
  if (pathname.startsWith('/admin/inicio')) return 'Inicio';
  return 'Administrador';
}

// ¿La ruta es una sub-pantalla de una rifa (crear/editar/boletos/sorteo/promos)?
// Estas tienen "atrás" a la lista de rifas en TODOS los tamaños.
function raffleBackTarget(pathname: string): string | null {
  if (
    pathname.startsWith('/admin/rifas/nueva') ||
    /^\/admin\/rifas\/[^/]+\/(editar|boletos|sorteo|promociones)/.test(pathname)
  ) {
    return '/admin/rifas';
  }
  return null;
}

// Secciones que en MÓVIL se abren desde el hub "Más" (atrás → /admin/mas).
// En escritorio son ítems de primer nivel del sidebar (sin "atrás").
function moreBackTarget(pathname: string): string | null {
  const fromMore = ['diseno', 'perfil', 'pagos', 'reportes', 'configuracion', 'usuarios'];
  if (fromMore.some((s) => pathname.startsWith(`/admin/${s}`))) return '/admin/mas';
  return null;
}

// ── Navegación del sidebar (escritorio) ──────────────────────
interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: boolean;
}
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Principal',
    items: [
      { to: '/admin/inicio', label: 'Inicio', icon: Home },
      { to: '/admin/ordenes', label: 'Órdenes', icon: Receipt, badge: true },
      { to: '/admin/rifas', label: 'Rifas', icon: Ticket },
    ],
  },
  {
    label: 'Tu página',
    items: [
      { to: '/admin/diseno', label: 'Apariencia', icon: Palette },
      { to: '/admin/perfil', label: 'Perfil', icon: User },
      { to: '/admin/pagos', label: 'Datos de pago', icon: CreditCard },
    ],
  },
  {
    label: 'Tu negocio',
    items: [
      { to: '/admin/reportes', label: 'Reportes', icon: FileBarChart },
      { to: '/admin/usuarios', label: 'Usuarios y Roles', icon: Users },
      { to: '/admin/configuracion', label: 'Ajustes', icon: Settings },
    ],
  },
];

// Navegación reducida para vendedores: solo su panel y sus ventas.
const SELLER_NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Vendedor',
    items: [
      { to: '/admin/inicio', label: 'Mi panel', icon: Home },
      { to: '/admin/ordenes', label: 'Mis ventas', icon: Receipt, badge: true },
    ],
  },
];

// ¿Está activo este ítem para la ruta actual? (cubre sus sub-rutas)
function isNavActive(pathname: string, to: string): boolean {
  return pathname === to || pathname.startsWith(`${to}/`);
}

// Sidebar de escritorio (lg+): navegación completa, sin tabs inferiores.
function DesktopSidebar({
  pathname,
  pendingTotal,
  groups,
  title,
  showViewPage,
  onNavigate,
  onLogout,
}: {
  pathname: string;
  pendingTotal: number;
  groups: { label: string; items: NavItem[] }[];
  title: string;
  showViewPage: boolean;
  onNavigate: (to: string) => void;
  onLogout: () => void;
}) {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r bg-card lg:flex xl:w-72">
      {/* Marca */}
      <div className="flex h-16 shrink-0 items-center gap-2.5 border-b px-5">
        <LogoMark className="h-7 w-7" />
        <span className="font-display text-lg font-extrabold tracking-tight">{title}</span>
      </div>

      {/* Navegación */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isNavActive(pathname, item.to);
                const Icon = item.icon;
                return (
                  <button
                    key={item.to}
                    type="button"
                    onClick={() => onNavigate(item.to)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    {active && (
                      <span className="absolute inset-y-1.5 left-0 w-1 rounded-full bg-primary" aria-hidden />
                    )}
                    <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={active ? 2.4 : 2} />
                    <span className="flex-1 truncate text-left">{item.label}</span>
                    {item.badge && pendingTotal > 0 && (
                      <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-none text-white">
                        {pendingTotal > 99 ? '99+' : pendingTotal}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Pie: ver página pública + cerrar sesión */}
      <div className="shrink-0 space-y-0.5 border-t p-3">
        {showViewPage && (
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Eye className="h-[18px] w-[18px] shrink-0" />
            Ver mi página
          </button>
        )}
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

function Tab({
  label,
  icon: Icon,
  active,
  badge,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  active: boolean;
  badge?: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1"
      aria-current={active ? 'page' : undefined}
    >
      <span className={cn('absolute top-0 h-[3px] w-9 rounded-full transition-colors', active ? 'bg-brand' : 'bg-transparent')} />
      <span className="relative">
        <Icon
          className={cn('h-[22px] w-[22px] transition-colors', active ? 'text-brand' : 'text-muted-foreground group-hover:text-foreground')}
          strokeWidth={active ? 2.4 : 2}
        />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -right-2.5 -top-2 grid h-[17px] min-w-[17px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </span>
      <span className={cn('text-[11px] tracking-tight transition-colors', active ? 'font-bold text-brand' : 'font-medium text-muted-foreground')}>
        {label}
      </span>
    </button>
  );
}

export function AdminDrawer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { total: pendingTotal } = useNotificationsSummary();
  const logout = useAuthStore((s) => s.logout);
  const role = useAuthStore((s) => s.user?.role);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Los vendedores ven un panel reducido (solo su panel y sus ventas).
  const isSeller = role === 'SELLER';

  const viewMyPage = () => navigate('/');
  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const raffleBack = raffleBackTarget(location.pathname);
  const moreBack = moreBackTarget(location.pathname);
  // En móvil cualquier sub-pantalla (rifa o sección de "Más") oculta los tabs.
  const isSubScreen = raffleBack !== null || moreBack !== null;

  // Cerrar con Escape (escritorio) + bloquear scroll del fondo (la página pública
  // queda detrás del panel; su scroll no debe filtrarse).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/');
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Al cambiar de pantalla, empezar arriba (evita aterrizar a media lista).
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  const onInicio = location.pathname.startsWith('/admin/inicio');
  const onOrdenes = location.pathname.startsWith('/admin/ordenes');
  const onRifas = location.pathname.startsWith('/admin/rifas');
  const masActive = !onInicio && !onOrdenes && !onRifas;

  return (
    <div className="fixed inset-0 z-50 flex bg-background">
      {/* Backdrop sólo en tablet (sm–md): deja ver la página detrás, click cierra.
          En escritorio (lg+) hay sidebar, así que no aplica. */}
      <button
        aria-label="Cerrar administrador"
        onClick={viewMyPage}
        className="hidden flex-1 animate-fade-in-fast cursor-default bg-black/40 backdrop-blur-[2px] sm:block lg:hidden"
      />

      {/* Sidebar de escritorio */}
      <DesktopSidebar
        pathname={location.pathname}
        pendingTotal={pendingTotal}
        groups={isSeller ? SELLER_NAV_GROUPS : NAV_GROUPS}
        title={isSeller ? 'Vendedor' : 'Administrador'}
        showViewPage={!isSeller}
        onNavigate={navigate}
        onLogout={() => void handleLogout()}
      />

      {/* Panel principal: pantalla completa en móvil, drawer en tablet, columna
          de contenido en escritorio (ocupa el resto junto al sidebar). */}
      <aside className="flex h-full w-full min-w-0 flex-col border-l bg-background shadow-2xl sm:max-w-lg sm:animate-slide-in-right lg:max-w-none lg:flex-1 lg:border-l-0 lg:shadow-none">
        {/* Barra superior: atrás contextual + título + ver mi página (móvil) */}
        <header className="flex shrink-0 items-center gap-1.5 border-b px-3 py-2.5 safe-top sm:px-4 lg:px-8 lg:py-3.5">
          {raffleBack ? (
            <button
              type="button"
              onClick={() => navigate(raffleBack)}
              aria-label="Atrás"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          ) : (
            moreBack && (
              // Las secciones de "Más" sólo necesitan "atrás" en móvil (en escritorio
              // están en el sidebar).
              <button
                type="button"
                onClick={() => navigate(moreBack)}
                aria-label="Atrás"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent lg:hidden"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )
          )}
          <h2
            className={cn(
              'min-w-0 flex-1 truncate font-display text-xl font-extrabold tracking-tight lg:text-2xl',
              !raffleBack && 'pl-2 lg:pl-0',
            )}
          >
            {sectionTitle(location.pathname)}
          </h2>
          {/* "Mi página": en escritorio vive en el sidebar; aquí sólo para móvil/tablet.
              Los vendedores no administran la página pública, así que ven "Salir". */}
          {isSeller ? (
            <button
              type="button"
              onClick={() => void handleLogout()}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:bg-accent lg:hidden"
            >
              <LogOut className="h-[18px] w-[18px]" />
              Salir
            </button>
          ) : (
            <button
              type="button"
              onClick={viewMyPage}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent lg:hidden"
            >
              <Eye className="h-[18px] w-[18px]" />
              Mi página
            </button>
          )}
        </header>

        {/* Contenido. El padding vive en el wrapper interior (NO en el scroller):
            el padding del scroller desplaza el anclaje de los elementos sticky.
            En escritorio se centra con un ancho cómodo de lectura/trabajo. */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain lg:bg-muted/30">
          <div
            className={cn(
              'mx-auto w-full max-w-5xl px-4 pt-4 sm:px-5 lg:px-8 lg:pt-6',
              // En sub-pantallas móviles no hay tabs: respetar el home indicator.
              isSubScreen ? 'pb-[max(1.25rem,env(safe-area-inset-bottom))]' : 'pb-8',
              'lg:pb-12',
            )}
          >
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </div>

        {/* Menú inferior (sólo móvil/tablet). Se oculta en sub-pantallas y en
            escritorio (que usa el sidebar). El vendedor ve solo su panel y ventas. */}
        {!isSubScreen && (
          <nav className="flex shrink-0 items-stretch border-t bg-background/95 backdrop-blur safe-bottom lg:hidden">
            {isSeller ? (
              <>
                <Tab label="Mi panel" icon={Home} active={onInicio} onClick={() => navigate('/admin/inicio')} />
                <Tab label="Mis ventas" icon={Receipt} active={onOrdenes} badge={pendingTotal} onClick={() => navigate('/admin/ordenes')} />
              </>
            ) : (
              <>
                <Tab label="Inicio" icon={Home} active={onInicio} onClick={() => navigate('/admin/inicio')} />
                <Tab label="Órdenes" icon={Receipt} active={onOrdenes} badge={pendingTotal} onClick={() => navigate('/admin/ordenes')} />
                <Tab label="Rifas" icon={Ticket} active={onRifas} onClick={() => navigate('/admin/rifas')} />
                <Tab label="Más" icon={Menu} active={masActive} onClick={() => navigate('/admin/mas')} />
              </>
            )}
          </nav>
        )}
      </aside>
    </div>
  );
}
