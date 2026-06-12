import { useEffect, useRef, Suspense } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Eye, Home, Receipt, Ticket, Menu, type LucideIcon } from 'lucide-react';
import { PageLoader } from '@/components/ui/misc';
import { cn } from '@/lib/cn';
import { useNotificationsSummary } from '@/lib/pwa/useNotificationsSummary';

function sectionTitle(pathname: string): string {
  if (pathname.startsWith('/panel/admin/ordenes')) return 'Órdenes';
  if (pathname.startsWith('/panel/admin/rifas/nueva')) return 'Nueva rifa';
  if (/^\/panel\/admin\/rifas\/[^/]+\/editar/.test(pathname)) return 'Editar rifa';
  if (/^\/panel\/admin\/rifas\/[^/]+\/boletos/.test(pathname)) return 'Boletos';
  if (/^\/panel\/admin\/rifas\/[^/]+\/sorteo/.test(pathname)) return 'Sorteo';
  if (pathname.startsWith('/panel/admin/rifas')) return 'Rifas';
  if (pathname.startsWith('/panel/admin/diseno')) return 'Apariencia';
  if (pathname.startsWith('/panel/admin/perfil')) return 'Perfil';
  if (pathname.startsWith('/panel/admin/pagos')) return 'Datos de pago';
  if (pathname.startsWith('/panel/admin/reportes')) return 'Reportes';
  if (pathname.startsWith('/panel/admin/plan')) return 'Mi plan';
  if (pathname.startsWith('/panel/admin/configuracion')) return 'Ajustes';
  if (pathname.startsWith('/panel/admin/mas')) return 'Más';
  if (pathname.startsWith('/panel/admin/inicio')) return 'Inicio';
  return 'Administrador';
}

// Sub-pantallas que no viven en el menú inferior: el header muestra "atrás"
// hacia su pantalla padre para que la jerarquía sea obvia en móvil.
function backTarget(pathname: string): string | null {
  if (
    pathname.startsWith('/panel/admin/rifas/nueva') ||
    /^\/panel\/admin\/rifas\/[^/]+\/(editar|boletos|sorteo)/.test(pathname)
  ) {
    return '/panel/admin/rifas';
  }
  // Secciones del menú "Más": atrás regresa al hub.
  const fromMore = ['diseno', 'perfil', 'pagos', 'reportes', 'plan', 'configuracion'];
  if (fromMore.some((s) => pathname.startsWith(`/panel/admin/${s}`))) return '/panel/admin/mas';
  return null;
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
  const scrollRef = useRef<HTMLDivElement>(null);

  const viewMyPage = () => navigate('/panel');
  const back = backTarget(location.pathname);

  // Cerrar con Escape (escritorio) + bloquear scroll del fondo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/panel');
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

  const onInicio = location.pathname.startsWith('/panel/admin/inicio');
  const onOrdenes = location.pathname.startsWith('/panel/admin/ordenes');
  const onRifas = location.pathname.startsWith('/panel/admin/rifas');
  const masActive = !onInicio && !onOrdenes && !onRifas;

  // En sub-pantallas (tienen "atrás") se oculta el menú inferior: más espacio
  // para trabajar y una jerarquía clara de "entrar → hacer → regresar".
  const isSubScreen = back !== null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop (escritorio): deja ver la página detrás, click cierra */}
      <button
        aria-label="Cerrar administrador"
        onClick={viewMyPage}
        className="hidden flex-1 animate-fade-in-fast cursor-default bg-black/40 backdrop-blur-[2px] lg:block"
      />

      {/* Panel: pantalla completa en móvil, drawer lateral en escritorio */}
      <aside className="flex h-full w-full animate-slide-in-right flex-col border-l bg-background shadow-2xl sm:max-w-lg lg:max-w-xl">
        {/* Barra superior: atrás contextual + título + ver mi página */}
        <header className="flex shrink-0 items-center gap-1.5 border-b px-3 py-2.5 safe-top sm:px-4">
          {back && (
            <button
              type="button"
              onClick={() => navigate(back)}
              aria-label="Atrás"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <h2 className={cn('min-w-0 flex-1 truncate font-display text-xl font-extrabold tracking-tight', !back && 'pl-2')}>
            {sectionTitle(location.pathname)}
          </h2>
          <button
            type="button"
            onClick={viewMyPage}
            className="flex h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-accent"
          >
            <Eye className="h-[18px] w-[18px]" />
            Mi página
          </button>
        </header>

        {/* Contenido. OJO: el padding vive en el wrapper interior, NO en el
            contenedor de scroll — el padding del scroller desplaza el punto de
            anclaje de los elementos sticky (top/bottom) y quedaban flotando. */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
          <div
            className={cn(
              'px-4 pt-4 sm:px-5',
              // En sub-pantallas no hay menú inferior: el padding respeta el
              // home indicator del iPhone.
              isSubScreen ? 'pb-[max(1.25rem,env(safe-area-inset-bottom))]' : 'pb-8',
            )}
          >
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </div>

        {/* Menú inferior: 4 pestañas (rutas reales; el botón atrás del teléfono
            funciona). Se oculta en sub-pantallas para despejar la vista. */}
        {!isSubScreen && (
          <nav className="flex shrink-0 items-stretch border-t bg-background/95 backdrop-blur safe-bottom">
            <Tab label="Inicio" icon={Home} active={onInicio} onClick={() => navigate('/panel/admin/inicio')} />
            <Tab label="Órdenes" icon={Receipt} active={onOrdenes} badge={pendingTotal} onClick={() => navigate('/panel/admin/ordenes')} />
            <Tab label="Rifas" icon={Ticket} active={onRifas} onClick={() => navigate('/panel/admin/rifas')} />
            <Tab label="Más" icon={Menu} active={masActive} onClick={() => navigate('/panel/admin/mas')} />
          </nav>
        )}
      </aside>
    </div>
  );
}
