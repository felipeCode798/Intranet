import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { TourProvider } from './components/Tour';
import { Loading } from './components/ui';
import AdminLayout from './layouts/AdminLayout';
import IntranetLayout from './layouts/IntranetLayout';
import Areas from './pages/admin/Areas';
import Attendance from './pages/admin/Attendance';
import Companies, { CompanyWizard } from './pages/admin/Companies';
import Dashboard from './pages/admin/Dashboard';
import Forms, { FormBuilder } from './pages/admin/Forms';
import Inbox, { AdminRequestPage } from './pages/admin/Inbox';
import Leaves from './pages/admin/Leaves';
import Performance from './pages/admin/Performance';
import Reports from './pages/admin/Reports';
import Schedules from './pages/admin/Schedules';
import Settings from './pages/admin/Settings';
import Tasks from './pages/admin/Tasks';
import Users from './pages/admin/Users';
import IntranetHome from './pages/intranet/IntranetHome';
import { Context, Documents, Quality, Strategy } from './pages/intranet/IntranetPages';
import { IntranetRequestPage, MyRequests, NewRequest, RequestCatalog } from './pages/intranet/IntranetRequests';
import { HomeRedirect, Login, NotificationsPage, Profile, RequestRedirect } from './pages/Misc';

function RequireAuth({ children, when }: { children: ReactNode; when?: boolean }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (when === false) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export default function App() {
  const { isSuper, isCompanyAdmin, isLeader, hasModule } = useAuth();
  const requests = hasModule('requests');
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<RequireAuth><HomeRedirect /></RequireAuth>} />
      <Route path="/solicitudes/:id" element={<RequireAuth><RequestRedirect /></RequireAuth>} />

      <Route path="/intranet/:slug" element={<RequireAuth when={hasModule('intranet')}><IntranetLayout /></RequireAuth>}>
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

      <Route path="/app" element={<RequireAuth><TourProvider><AdminLayout /></TourProvider></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="bandeja" element={<RequireAuth when={requests}><Inbox /></RequireAuth>} />
        <Route path="solicitudes/:id" element={<RequireAuth when={requests}><AdminRequestPage /></RequireAuth>} />
        <Route path="formularios" element={<RequireAuth when={isLeader && requests}><Forms /></RequireAuth>} />
        <Route path="formularios/nuevo" element={<RequireAuth when={isLeader && requests}><FormBuilder /></RequireAuth>} />
        <Route path="formularios/:id" element={<RequireAuth when={isLeader && requests}><FormBuilder key="edit" /></RequireAuth>} />
        <Route path="reportes" element={<RequireAuth when={(isLeader || isCompanyAdmin) && hasModule('reports') && requests}><Reports /></RequireAuth>} />
        <Route path="tareas" element={<RequireAuth when={hasModule('tasks')}><Tasks /></RequireAuth>} />
        <Route path="asistencia" element={<RequireAuth when={hasModule('attendance')}><Attendance /></RequireAuth>} />
        <Route path="horarios" element={<RequireAuth when={hasModule('schedules')}><Schedules /></RequireAuth>} />
        <Route path="permisos" element={<RequireAuth when={hasModule('leaves')}><Leaves /></RequireAuth>} />
        <Route path="desempeno" element={<RequireAuth when={hasModule('performance')}><Performance /></RequireAuth>} />
        <Route path="configuracion" element={<RequireAuth when={isSuper}><Settings /></RequireAuth>} />
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
