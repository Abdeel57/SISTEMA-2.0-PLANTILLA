import { useNavigate } from 'react-router-dom';
import { MoreMenu } from '@/components/owner/MoreMenu';

// Pestaña "Más" del panel como ruta real (/admin/mas): el botón atrás
// del teléfono y los enlaces directos funcionan como en cualquier pantalla.
export default function PanelMore() {
  const navigate = useNavigate();
  return <MoreMenu onPick={(to) => navigate(to)} />;
}
