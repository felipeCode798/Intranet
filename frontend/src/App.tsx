import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { TourProvider } from './components/Tour';
import { Loading } from './components/ui';
import AdminLayout from './layouts/AdminLayout';
import IntranetLayout from './layouts/IntranetLayout';
import Areas from './pages/admin/Areas';
import Companies, { CompanyWizard } from './pages/admin/Companies';
import Dashboard from './pages/admin/Dashboard';
import Forms, { FormBuilder } from './pages/admin/Forms';
import Inbox, { AdminRequestPage } from './pages/admin/Inbox';
import Reports from './pages/admin/Reports';
import Users from './pages/admin/Users';
import IntranetHome from './pages/intranet/IntranetHome';
import { Context, Documents, Quality, Strategy } from './pages/intranet/IntranetPages';
import { IntranetRequestPage, MyRequests, NewRequest, RequestCatalog } from './pages/intranet/IntranetRequests';
import { HomeRedirect, Login, NotificationsPage, Profile, RequestRedirect } from './pages/Misc';

function RequireAuth({ children, panel, when }: { children: ReactNode; panel?: boolean; when?: boolean }) {
  const { user, loading, hasPanel } = useAuth();
  const loc = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (panel && !hasPanel) return <Navigate to="/" replace />;
  if (when === false) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export default function App() {
  const { isSuper, isCompanyAdmin, isLeader } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><HomeRedirect /></RequireAuth>} />
      <Route path="/solicitudes/:id" element={<RequireAuth><RequestRedirect /></RequireAuth>} />

      <Route path="/intranet/:slug" element={<RequireAuth><IntranetLayout /></RequireAuth>}>
        <Route index element={<IntranetHome />} />
        <Route path="solicitudes" element={<RequestCatalog />} />
        <Route path="solicitudes/nueva/:formId" element={<NewRequest />} />
        <Route path="solicitudes/:id" element={<IntranetRequestPage />} />
        <Route path="mis-solicitudes" element={<MyRequests />} />
        <Route path="estrategia" element={<Strategy />} />
        <Route path="contexto" element={<Context />} />
        <Route path="documentacion" element={<Documents />} />
        <Route path="sistema-gestion" element={<Quality />} />
      </Route>

      <Route path="/app" element={<RequireAuth panel><TourProvider><AdminLayout /></TourProvider></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="bandeja" element={<Inbox />} />
        <Route path="solicitudes/:id" element={<AdminRequestPage />} />
        <Route path="formularios" element={<RequireAuth when={isLeader}><Forms /></RequireAuth>} />
        <Route path="formularios/nuevo" element={<RequireAuth when={isLeader}><FormBuilder /></RequireAuth>} />
        <Route path="formularios/:id" element={<RequireAuth when={isLeader}><FormBuilder key="edit" /></RequireAuth>} />
        <Route path="reportes" element={<RequireAuth when={isLeader || isCompanyAdmin}><Reports /></RequireAuth>} />
        <Route path="empresas" element={<RequireAuth when={isSuper || isCompanyAdmin}><Companies /></RequireAuth>} />
        <Route path="empresas/nueva" element={<RequireAuth when={isSuper}><CompanyWizard /></RequireAuth>} />
        <Route path="empresas/:id" element={<RequireAuth when={isSuper || isCompanyAdmin}><CompanyWizard key="edit" /></RequireAuth>} />
        <Route path="areas" element={<RequireAuth when={isSuper || isCompanyAdmin || isLeader}><Areas /></RequireAuth>} />
        <Route path="usuarios" element={<RequireAuth when={isSuper || isCompanyAdmin}><Users /></RequireAuth>} />
        <Route path="notificaciones" element={<NotificationsPage />} />
        <Route path="perfil" element={<Profile />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
