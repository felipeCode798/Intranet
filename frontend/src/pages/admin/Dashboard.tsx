import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlarmClock, ArrowUpRight, CalendarClock, ChevronLeft, ChevronRight, Gift, Inbox, MoreHorizontal, Pencil, Plus, ShieldAlert, Sparkles, Trash2, UserCheck, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { Avatar, Empty, Loading, PriorityBadge, ProgressRing, SlaBar, StatusBadge } from '../../components/ui';
import { useNotifications } from '../../layouts/AdminLayout';
import { api } from '../../lib/api';
import { fmtDate, fmtDateTime, fmtTime, remaining } from '../../lib/format';
import type { RequestItem } from '../../lib/types';

interface Overview {
  counts: { pendingAssignment: number; escalations: number; toAccept: number; inProgress: number; overdueArea: number; overdueMine: number; myOpen: number };
  isLeader: boolean;
  myTasks: RequestItem[];
  areaQueue: RequestItem[];
  calendar: { id: string; code: string; subject: string; dueAt: string; status: string; isOverdue: boolean; area: { name: string } }[];
  compliance: { label: string; total: number; onTime: number; pct: number }[];
  nextDue: RequestItem | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['overview'], queryFn: async () => (await api.get<Overview>('/requests/overview')).data, refetchInterval: 60000 });
  const { data: notif } = useNotifications();
  const slug = user?.company?.slug;
  if (isLoading || !data) return <Loading />;
  const c = data.counts;

  const features = data.isLeader
    ? [
        { n: c.pendingAssignment, t: 'Por asignar', s: 'Esperan responsable en tus áreas', icon: UserPlus, to: '/app/bandeja?tab=area&status=PENDING_ASSIGNMENT' },
        { n: c.escalations, t: 'Escalamientos', s: 'Reasignar o trasladar', icon: ShieldAlert, to: '/app/bandeja?tab=area&status=ESCALATION_REQUESTED' },
        { n: c.overdueArea, t: 'Vencidas', s: 'Superaron el plazo', icon: AlarmClock, to: '/app/bandeja?tab=area&overdue=true', alert: c.overdueArea > 0 },
      ]
    : [
        { n: c.toAccept, t: 'Por aceptar', s: 'Asignadas a ti', icon: UserCheck, to: '/app/bandeja?tab=assigned&status=ASSIGNED' },
        { n: c.inProgress, t: 'En gestión', s: 'Aceptadas por ti', icon: Inbox, to: '/app/bandeja?tab=assigned&status=IN_PROGRESS' },
        { n: c.overdueMine, t: 'Vencidas', s: 'Requieren atención', icon: AlarmClock, to: '/app/bandeja?tab=assigned&overdue=true', alert: c.overdueMine > 0 },
      ];

  const assignments = data.isLeader && data.areaQueue.length ? data.areaQueue : data.myTasks;

  return (
    <>
      <section className="dash-hero">
        <div className="hello">
          <h1>
            ¡Hola, {user?.name.split(' ')[0]}!
            <span className="hello-badges" aria-hidden>
              <span><Sparkles /></span>
              <span><Inbox /></span>
            </span>
            <br />
            ¿Qué solicitudes gestionamos hoy?
          </h1>
          <p>Este panel reúne tus asignaciones, las solicitudes de tus áreas y sus vencimientos para que nada se quede sin respuesta.</p>
        </div>
        <Link className="add-board" to={slug ? `/intranet/${slug}/solicitudes` : '/app/bandeja'} aria-label="Nueva solicitud">
          <div>
            <div className="plus" style={{ margin: '0 auto' }}>
              <Plus />
            </div>
            <span>Nueva solicitud</span>
          </div>
        </Link>
        {features.map((f) => (
          <Link key={f.t} to={f.to} className={`feature-card ${f.alert ? 'alert' : ''}`}>
            <div className="illus">
              <span className="ring" />
              <span className="ico">
                <f.icon />
              </span>
            </div>
            <div>
              <span className="num">{f.n}</span>
              <b>{f.t}</b>
              <small>{f.s}</small>
            </div>
          </Link>
        ))}
      </section>

      <section className="dash-row r1">
        <div className="card">
          <div className="card-h">
            <h2>Notificaciones</h2>
            <Link className="link" to="/app/notificaciones">
              <Trash2 /> Ver todas
            </Link>
          </div>
          <div className="notif-stack">
            {(notif?.items || []).slice(0, 3).map((n) => (
              <Link key={n.id} className={`notif-card ${n.read ? 'read' : ''}`} to={n.requestId ? `/app/solicitudes/${n.requestId}` : '/app/notificaciones'}>
                <div className="row between">
                  <b>
                    {n.title.split(' · ')[0]} {!n.read && <span className="dot" style={{ background: 'var(--good)' }} />}
                  </b>
                  <MoreHorizontal size={16} className="faint" />
                </div>
                <div className="meta">
                  {n.title.split(' · ')[1]} · {fmtDateTime(n.createdAt)}
                </div>
                <div className="nbody">
                  <p>{n.body}</p>
                </div>
              </Link>
            ))}
            {!notif?.items.length && <Empty title="Sin notificaciones" text="Aquí verás cada movimiento de tus solicitudes." />}
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h2>{data.isLeader && data.areaQueue.length ? 'Por gestionar en tus áreas' : 'Mis asignaciones'}</h2>
            <Link className="link" to="/app/bandeja">
              <Pencil /> Bandeja
            </Link>
          </div>
          {assignments.slice(0, 2).map((r) => (
            <Link key={r.id} className="assign-card" to={`/app/solicitudes/${r.id}`}>
              <div className="top">
                <span className="area">{r.area.name}</span>
                <span className="bold">{r.code}</span>
                <MoreHorizontal size={16} className="faint" style={{ marginLeft: 'auto' }} />
              </div>
              <div className="title">
                <span>{r.subject}</span>
                <PriorityBadge priority={r.priority} />
              </div>
              <div className="foot">
                <StatusBadge status={r.status} />
                <span className="row" style={{ gap: 6 }}>
                  {r.requester.name} <Avatar name={r.requester.name} size="sm" />
                </span>
              </div>
            </Link>
          ))}
          {!assignments.length && <Empty title="Todo al día" text="No tienes solicitudes pendientes." />}
          <button className="add-assign" onClick={() => nav(slug ? `/intranet/${slug}/solicitudes` : '/app/bandeja')}>
            <span className="plus">
              <Plus />
            </span>
            Radicar nueva solicitud
          </button>
        </div>

        <DueCalendar items={data.calendar} />
      </section>

      <section className="dash-row r2">
        <div className="card">
          <div className="card-h">
            <h2>
              Tareas activas{' '}
              <span className="avatars" style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: 8 }}>
                {[...new Set(data.myTasks.map((t) => t.requester.name))].slice(0, 3).map((n) => (
                  <Avatar key={n} name={n} size="sm" />
                ))}
              </span>
            </h2>
            <Link className="link" to="/app/bandeja?tab=assigned">
              <ArrowUpRight /> Ver bandeja
            </Link>
          </div>
          {data.myTasks.map((r) => (
            <Link key={r.id} className={`task-row ${r.isOverdue ? 'late' : ''}`} to={`/app/solicitudes/${r.id}`}>
              <div>
                <b>{r.subject}</b>
                <small>
                  {r.code} · {fmtDate(r.createdAt)}
                </small>
              </div>
              <div className="dur">
                <small className="faint">Plazo</small>
                <b className={r.isOverdue ? 'late-text' : ''}>{remaining(r.remainingMs).replace('Vence en ', '')}</b>
              </div>
              <SlaBar progress={r.slaProgress} />
              <StatusBadge status={r.status} />
            </Link>
          ))}
          {!data.myTasks.length && <Empty title="Sin tareas asignadas" text="Cuando un líder te asigne una solicitud aparecerá aquí." />}
        </div>

        <div className="cta-card">
          <div className="gift">
            <Gift />
          </div>
          <h3>¡Radica en segundos!</h3>
          <p>Cada área tiene su formulario y su plazo. Te avisamos por correo en cada paso.</p>
          <Link className="btn" to={slug ? `/intranet/${slug}/solicitudes` : '/app/bandeja'}>
            Crear solicitud
          </Link>
        </div>

        <div className="stack" style={{ gap: 20 }}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {(data.compliance.length ? data.compliance.slice(0, 2) : [{ label: 'Cumplimiento', pct: 0, total: 0, onTime: 0 }]).map((cmp) => (
              <div className="card ring-card" key={cmp.label} style={{ padding: 18 }}>
                <div className="ring-wrap">
                  <ProgressRing pct={cmp.pct} size={60} />
                  <div className="lbl">
                    <small>A tiempo · 90 días</small>
                    <b>{cmp.label}</b>
                  </div>
                </div>
                <div className="ring-foot">
                  <span>
                    {cmp.onTime}/{cmp.total} respondidas
                    <br />
                    dentro del plazo
                  </span>
                  {data.isLeader && (
                    <Link className="btn sm" to="/app/reportes">
                      Ver
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="card next-card">
            <div className="card-h" style={{ marginBottom: 0 }}>
              <h2>Próximo vencimiento</h2>
              <CalendarClock size={18} className="faint" />
            </div>
            {data.nextDue ? (
              <>
                <div className="when">
                  <span className="dot" /> {fmtDateTime(data.nextDue.dueAt)} · {remaining(data.nextDue.remainingMs)}
                </div>
                <div className="row between" style={{ alignItems: 'flex-end' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="bold">{data.nextDue.subject}</div>
                    <div className="small faint">
                      {data.nextDue.code} · {data.nextDue.area.name}
                    </div>
                  </div>
                  <div className="row">
                    <Link className="btn sm ghost" to={`/app/solicitudes/${data.nextDue.id}`}>
                      Ver
                    </Link>
                    <button
                      className="btn sm"
                      onClick={() => {
                        qc.invalidateQueries({ queryKey: ['overview'] });
                        nav(`/app/solicitudes/${data.nextDue!.id}`);
                      }}
                    >
                      Gestionar
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <p className="small faint" style={{ marginTop: 10 }}>No hay vencimientos próximos.</p>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

function DueCalendar({ items }: { items: Overview['calendar'] }) {
  const [sel, setSel] = useState(() => new Date());
  const [ref, setRef] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const byDay = useMemo(() => {
    const m = new Map<string, Overview['calendar']>();
    items.forEach((i) => {
      const k = new Date(i.dueAt).toDateString();
      m.set(k, [...(m.get(k) || []), i]);
    });
    return m;
  }, [items]);
  const y = ref.getFullYear(),
    mo = ref.getMonth();
  const first = (new Date(y, mo, 1).getDay() + 6) % 7;
  const days = new Date(y, mo + 1, 0).getDate();
  const today = new Date().toDateString();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(y, mo, d));
  const selected = byDay.get(sel.toDateString()) || [];

  return (
    <div className="card mini-cal">
      <div className="card-h">
        <h2>{((s) => s.charAt(0).toUpperCase() + s.slice(1))(ref.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' }))}</h2>
        <div className="row" style={{ gap: 6 }}>
          <button className="round-btn" onClick={() => setRef(new Date(y, mo - 1, 1))} aria-label="Mes anterior">
            <ChevronLeft />
          </button>
          <button className="round-btn" onClick={() => setRef(new Date(y, mo + 1, 1))} aria-label="Mes siguiente">
            <ChevronRight />
          </button>
        </div>
      </div>
      <div className="week">
        {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
          <div key={d} className="dow">
            {d}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const evs = byDay.get(d.toDateString()) || [];
          return (
            <div
              key={i}
              className={`day ${d.toDateString() === today ? 'today' : ''} ${d.toDateString() === sel.toDateString() ? 'sel' : ''}`}
              onClick={() => setSel(d)}
              title={evs.length ? `${evs.length} vencimiento(s)` : undefined}
            >
              {d.getDate()}
              {evs.length > 0 && (
                <span className="dots">
                  {evs.slice(0, 3).map((e) => (
                    <i key={e.id} className={e.isOverdue ? 'late' : ''} />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="cal-events">
        <div className="cal-time">
          {sel.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' })} <span className="hr-dashed" />
        </div>
        {selected.slice(0, 3).map((e) => (
          <Link key={e.id} className="cal-ev" to={`/app/solicitudes/${e.id}`}>
            <span className={`ico-box sm ${e.isOverdue ? 'tone-red' : ''}`}>
              <AlarmClock />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <b>{e.subject}</b>
              <small>
                {fmtTime(e.dueAt)} · <span className="dot" style={{ background: e.isOverdue ? 'var(--critical)' : 'var(--p)' }} /> {e.area.name}
              </small>
            </div>
            <MoreHorizontal size={16} className="faint" />
          </Link>
        ))}
        {!selected.length && <div className="small faint">Sin vencimientos este día.</div>}
      </div>
    </div>
  );
}
