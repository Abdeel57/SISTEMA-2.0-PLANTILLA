import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { usePwaBranding } from '@/hooks/usePwaBranding';
import { BrandLoader } from '@/components/brand/BrandLoader';
import { OwnerShell } from '@/components/owner/OwnerShell';
import { AdminDrawer } from '@/components/owner/AdminDrawer';
import { RequireRifero, RequireGuest, RequireAdmin } from '@/components/RouteGuards';
import { OfflineBanner } from '@/components/layout/OfflineBanner';
import { InstallBanner } from '@/components/layout/InstallBanner';
import { ThemeController } from '@/components/brand/ThemeController';

// ── Páginas (lazy) ──────────────────────────────────────────
const Login = lazy(() => import('@/pages/auth/Login'));

const PublicRifero = lazy(() => import('@/pages/public/PublicRifero'));
const PublicRaffle = lazy(() => import('@/pages/public/PublicRaffle'));
const Validation = lazy(() => import('@/pages/public/Validation'));
const DigitalTicket = lazy(() => import('@/pages/public/DigitalTicket'));
const RiferoPayment = lazy(() => import('@/pages/public/RiferoPayment'));
const VerifyTickets = lazy(() => import('@/pages/public/VerifyTickets'));

const PanelHome = lazy(() => import('@/pages/dashboard/PanelHome'));
const DashUsers = lazy(() => import('@/pages/dashboard/Users'));
const DashOrders = lazy(() => import('@/pages/dashboard/Orders'));
const DashRaffles = lazy(() => import('@/pages/dashboard/RafflesList'));
const DashRaffleForm = lazy(() => import('@/pages/dashboard/RaffleForm'));
const DashRaffleTickets = lazy(() => import('@/pages/dashboard/RaffleTickets'));
const DashRaffleDraw = lazy(() => import('@/pages/dashboard/RaffleDraw'));
const DashRafflePromo = lazy(() => import('@/pages/dashboard/RafflePromo'));
const DashProfile = lazy(() => import('@/pages/dashboard/Profile'));
const DashDesign = lazy(() => import('@/pages/dashboard/Design'));
const DashPayments = lazy(() => import('@/pages/dashboard/Payments'));
const DashReports = lazy(() => import('@/pages/dashboard/Reports'));
const DashSettings = lazy(() => import('@/pages/dashboard/Settings'));
const DashMore = lazy(() => import('@/pages/dashboard/PanelMore'));

function Fallback() {
  return <BrandLoader />;
}

// Sitio single-tenant: la página pública del rifero ES la raíz. El alias "_"
// le dice a la API "el rifero de este sitio" (hay uno solo por despliegue).
const SITE = '_';

export function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe);
  useEffect(() => {
    void fetchMe();
  }, [fetchMe]);
  // Marca de la PWA según la sección: admin = Sortea (siempre), público = rifero.
  usePwaBranding();

  return (
    <>
      <ThemeController />
      <OfflineBanner />
      <Suspense fallback={<Fallback />}>
        <Routes>
          {/* ── Página pública del rifero ── */}
          <Route path="/" element={<PublicRifero subdomain={SITE} />} />
          <Route path="/validar/:code" element={<Validation />} />
          <Route path="/boleto/:code" element={<DigitalTicket />} />
          <Route path="/pago/:code" element={<RiferoPayment />} />
          <Route path="/verificar" element={<VerifyTickets subdomain={SITE} />} />

          {/* ── Acceso del administrador ── */}
          <Route path="/login" element={<RequireGuest><Login /></RequireGuest>} />

          {/* ── Administrador del rifero (requiere iniciar sesión) ── */}
          <Route
            path="/admin"
            element={
              <RequireRifero>
                <OwnerShell />
              </RequireRifero>
            }
          >
            <Route index element={<Navigate to="/admin/inicio" replace />} />
            <Route element={<AdminDrawer />}>
              {/* Abiertas a todo el staff (vendedores incluidos; la API acota
                  los datos por vendedor). */}
              <Route path="inicio" element={<PanelHome />} />
              <Route path="ordenes" element={<DashOrders />} />
              <Route path="ordenes/:filter" element={<DashOrders />} />

              {/* Solo administradores. Un vendedor que entre por URL directa es
                  redirigido a su panel (defensa de frontend; la API ya bloquea). */}
              <Route element={<RequireAdmin><Outlet /></RequireAdmin>}>
                <Route path="rifas" element={<DashRaffles />} />
                <Route path="rifas/nueva" element={<DashRaffleForm />} />
                <Route path="rifas/:id/editar" element={<DashRaffleForm />} />
                <Route path="rifas/:id/boletos" element={<DashRaffleTickets />} />
                <Route path="rifas/:id/sorteo" element={<DashRaffleDraw />} />
                <Route path="rifas/:id/promociones" element={<DashRafflePromo />} />
                <Route path="diseno" element={<DashDesign />} />
                <Route path="perfil" element={<DashProfile />} />
                <Route path="pagos" element={<DashPayments />} />
                <Route path="reportes" element={<DashReports />} />
                <Route path="configuracion" element={<DashSettings />} />
                <Route path="usuarios" element={<DashUsers />} />
                <Route path="mas" element={<DashMore />} />
              </Route>
            </Route>
          </Route>

          {/* ── Compatibilidad con rutas anteriores ── */}
          <Route path="/panel" element={<Navigate to="/admin" replace />} />
          <Route path="/panel/admin/*" element={<Navigate to="/admin" replace />} />
          <Route path="/r/:slug" element={<Navigate to="/" replace />} />
          <Route path="/r/:slug/verificar" element={<Navigate to="/verificar" replace />} />

          {/* Detalle de una rifa: /e1, /e2, … */}
          <Route path="/:eventParam" element={<PublicRaffle subdomain={SITE} />} />
          {/* Link de vendedor: /e1/VEN01 — misma rifa, atribuida a ese vendedor. */}
          <Route path="/:eventParam/:ref" element={<PublicRaffle subdomain={SITE} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      <InstallBanner />
    </>
  );
}
