import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/cn';

interface RowDef {
  title: string;
  desc?: string;
  to?: string;
  action?: 'verPagina' | 'cerrarSesion';
  danger?: boolean;
}

const GROUPS: { label: string; rows: RowDef[] }[] = [
  {
    label: 'Tu página',
    rows: [
      { title: 'Apariencia', desc: 'Logo, colores y portada', to: '/admin/diseno' },
      { title: 'Perfil', desc: 'Nombre, descripción y redes', to: '/admin/perfil' },
    ],
  },
  {
    label: 'Cobros',
    rows: [
      { title: 'Datos de pago', desc: 'Cuenta, CLABE e instrucciones', to: '/admin/pagos' },
    ],
  },
  {
    label: 'Tu negocio',
    rows: [
      { title: 'Resumen', desc: 'Métricas de tus rifas', to: '/admin/inicio' },
      { title: 'Reportes', desc: 'Exporta órdenes, boletos y compradores', to: '/admin/reportes' },
      { title: 'Usuarios y Roles', desc: 'Administradores y vendedores con su link', to: '/admin/usuarios' },
      { title: 'Ajustes', desc: 'Apartado, comprobantes y ganadores', to: '/admin/configuracion' },
    ],
  },
  {
    label: 'Cuenta',
    rows: [
      { title: 'Ver mi página pública', action: 'verPagina' },
      { title: 'Cerrar sesión', action: 'cerrarSesion', danger: true },
    ],
  },
];

// Hub de configuración (pestaña "Más"). Diseño tipo ajustes: filas con título +
// descripción y un chevron discreto. Sin iconos decorativos.
export function MoreMenu({ onPick }: { onPick: (to: string) => void }) {
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);

  const handle = async (row: RowDef) => {
    if (row.to) return onPick(row.to);
    if (row.action === 'verPagina') return navigate('/');
    if (row.action === 'cerrarSesion') {
      await logout();
      navigate('/', { replace: true });
    }
  };

  return (
    <div className="space-y-7">
      {GROUPS.map((group) => (
        <section key={group.label}>
          <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {group.label}
          </h3>
          <div className="divide-y overflow-hidden rounded-2xl border bg-card">
            {group.rows.map((row) => (
              <button
                key={row.title}
                type="button"
                onClick={() => void handle(row)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent active:bg-accent/70"
              >
                <span className="min-w-0">
                  <span className={cn('block text-[15px] font-medium', row.danger && 'text-destructive')}>
                    {row.title}
                  </span>
                  {row.desc && <span className="mt-0.5 block text-xs text-muted-foreground">{row.desc}</span>}
                </span>
                {!row.danger && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
              </button>
            ))}
          </div>
        </section>
      ))}

      <p className="px-1 pb-2 text-center text-[11px] text-muted-foreground/70">Bismark · Panel del rifero</p>
    </div>
  );
}
