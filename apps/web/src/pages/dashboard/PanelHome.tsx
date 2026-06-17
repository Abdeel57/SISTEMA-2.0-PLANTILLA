import { useAuthStore } from '@/store/auth';
import DashHome from './Home';
import SellerHome from './SellerHome';

// Pantalla de inicio del panel según el rol: los vendedores ven su panel
// reducido (su link + métricas + acceso a sus ventas); los administradores, el
// resumen completo del rifero.
export default function PanelHome() {
  const role = useAuthStore((s) => s.user?.role);
  return role === 'SELLER' ? <SellerHome /> : <DashHome />;
}
