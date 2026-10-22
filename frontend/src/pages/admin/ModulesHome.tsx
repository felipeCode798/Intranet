import { useQuery } from '@tanstack/react-query';
import { CalendarClock, CalendarOff, ClipboardCheck, Fingerprint, Target } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { api } from '../../lib/api';
import { fmtMinutes } from '../../lib/performance';
import { shiftLabel } from '../../lib/schedule';
import type { AttendanceMe, Leave, MySchedule } from '../../lib/types';

/** Resumen de "mi día" con los módulos de personal que estén activos (tareas, asistencia, horarios y permisos) */
export default function ModulesHome({ standalone }: { standalone?: boolean }) {
  const { user, hasModule, isLeader, isCompanyAdmin } = useAuth();
  const tasksOn = hasModule('tasks');
  const attOn = hasModule('attendance');
  const schOn = hasModule('schedules');
  const leavesOn = hasModule('leaves');
  const perfOn = hasModule('performance');

  const tasks = useQuery({
    queryKey: ['tasks', 'summary'],
    queryFn: async () => (await api.get<{ pending: number; overdue: number; teamOpen: number; teamOverdue: number; isLeader: boolean }>('/tasks/summary')).data,
    enabled: tasksOn,
  });
  const att = useQuery({ queryKey: ['attendance', 'me'], queryFn: async () => (await api.get<AttendanceMe>('/attendance/me')).data, enabled: attOn });
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const sch = useQuery({
    queryKey: ['schedules', 'me', today, today],
    queryFn: async () => (await api.get<MySchedule>('/schedules/me', { params: { from: today, to: today } })).data,
    enabled: schOn,
  });
  const reviewer = isLeader || isCompanyAdmin;
  const pend = useQuery({
    queryKey: ['leaves', 'pending-count'],
    queryFn: async () => (await api.get<{ pending: number }>('/leaves/pending-count')).data.pending,
    enabled: leavesOn && reviewer,
  });
  const mine = useQuery({
    queryKey: ['leaves', 'mine-open'],
    queryFn: async () => (await api.get<Leave[]>('/leaves', { params: { scope: 'mine', status: 'PENDING' } })).data,
    enabled: leavesOn,
  });

  const perf = useQuery({
    queryKey: ['performance', 'summary'],
    queryFn: async () => (await api.get<{ roles: number; monthMinutes: number }>('/performance/summary')).data,
    enabled: perfOn,
  });

  const cards = [
    tasksOn && {
      to: '/app/tareas',
      icon: ClipboardCheck,
      title: 'Tareas',
      value: tasks.data?.pending ?? '—',
      sub: tasks.data?.overdue ? `${tasks.data.overdue} vencida(s)` : tasks.data?.isLeader ? `${tasks.data.teamOpen} abiertas en tu equipo` : 'Pendientes asignadas a ti',
      alert: !!tasks.data?.overdue,
    },
    attOn && {
      to: '/app/asistencia',
      icon: Fingerprint,
      title: 'Asistencia',
      value: att.data ? (att.data.nextType === 'CHECK_IN' ? 'Registrar entrada' : 'Registrar salida') : '—',
      sub: att.data?.todayRecords.length ? `${att.data.todayRecords.length} registro(s) hoy` : 'Aún sin registros hoy',
      small: true,
    },
    schOn && {
      to: '/app/horarios',
      icon: CalendarClock,
      title: 'Horario de hoy',
      value: sch.data ? shiftLabel(sch.data.entries[0]) : '—',
      sub: sch.data?.entries[0]?.area?.name ?? 'Consulta tu semana',
      small: true,
    },
    leavesOn && {
      to: '/app/permisos',
      icon: CalendarOff,
      title: 'Permisos',
      value: reviewer ? (pend.data ?? '—') : (mine.data?.length ?? '—'),
      sub: reviewer ? 'Por aprobar en tu equipo' : 'Solicitudes pendientes',
      alert: reviewer && !!pend.data,
    },
    perfOn && {
      to: '/app/desempeno',
      icon: Target,
      title: 'Desempeño',
      value: perf.data ? fmtMinutes(perf.data.monthMinutes) : '—',
      sub: perf.data?.roles ? `Tiempo registrado este mes · ${perf.data.roles} rol(es)` : 'Cargos, KPI y tiempo por empresa',
      small: true,
    },
  ].filter(Boolean) as { to: string; icon: typeof ClipboardCheck; title: string; value: string | number; sub: string; alert?: boolean; small?: boolean }[];

  if (!cards.length && !standalone) return null;
  return (
    <>
      {standalone && (
        <div className="page-head">
          <div>
            <h1 className="page-title">¡Hola, {user?.name.split(' ')[0]}!</h1>
            <p className="page-sub">Este es tu resumen de hoy.</p>
          </div>
        </div>
      )}
      {!cards.length && <div className="card">No hay módulos activos para tu empresa. Consulta con el administrador.</div>}
      <div className="kpis" style={standalone ? undefined : { marginTop: 22 }} data-tour="modules-home">
        {cards.map((c) => (
          <Link key={c.to} to={c.to} className="kpi" style={{ display: 'block' }}>
            <small>
              <c.icon /> {c.title}
            </small>
            <div className="v" style={{ color: c.alert ? 'var(--critical)' : undefined, fontSize: c.small ? 20 : undefined, marginTop: c.small ? 12 : undefined }}>
              {c.value}
            </div>
            <div className="sub small faint">{c.sub}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
