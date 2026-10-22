import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarDays, Check, ClipboardCheck, Pencil, Play, Plus, RotateCcw, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Avatar, Empty, Loading, Modal, PriorityBadge, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { PRIORITY } from '../../lib/format';
import { fmtDayFull, todayYmd } from '../../lib/schedule';
import type { Area, Priority, Task, TaskStatus } from '../../lib/types';

const COLUMNS: { key: TaskStatus; label: string; tone: string }[] = [
  { key: 'TODO', label: 'Por hacer', tone: 'violet' },
  { key: 'IN_PROGRESS', label: 'En curso', tone: 'blue' },
  { key: 'DONE', label: 'Hechas', tone: 'green' },
];

export default function Tasks() {
  const { isSuper, isLeader, leaderAreaIds } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [scope, setScope] = useState<'mine' | 'team'>('mine');
  const [areaId, setAreaId] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [edit, setEdit] = useState<Task | 'new' | null>(null);
  const [completing, setCompleting] = useState<Task | null>(null);

  const status = showCancelled ? 'TODO,IN_PROGRESS,DONE,CANCELLED' : 'TODO,IN_PROGRESS,DONE';
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', scope, areaId, status],
    queryFn: async () => (await api.get<Task[]>('/tasks', { params: { scope, areaId: areaId || undefined, status } })).data,
  });
  const { data: areas = [] } = useQuery({
    queryKey: ['areas', 'mine'],
    queryFn: async () => (await api.get<Area[]>('/areas/mine')).data,
    enabled: isLeader,
  });
  const ledAreas = useMemo(() => areas.filter((a) => isSuper || leaderAreaIds.includes(a.id)), [areas, isSuper, leaderAreaIds]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['tasks'] });
  const setStatus = async (t: Task, next: TaskStatus, note?: string) => {
    try {
      await api.post(`/tasks/${t.id}/status`, { status: next, note: note || undefined });
      toast(next === 'DONE' ? 'Tarea completada' : next === 'IN_PROGRESS' ? 'Tarea en curso' : next === 'CANCELLED' ? 'Tarea cancelada' : 'Tarea actualizada');
      refresh();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const open = tasks.filter((t) => t.status === 'TODO' || t.status === 'IN_PROGRESS');
  const overdue = open.filter((t) => t.isOverdue).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Tareas</h1>
          <p className="page-sub">{isLeader ? 'Asigna tareas a los colaboradores de tus áreas y haz seguimiento.' : 'Las tareas que tu líder te asignó.'}</p>
        </div>
        <div className="row wrap">
          {isLeader && (
            <div className="tabs">
              <button className={scope === 'mine' ? 'on' : ''} onClick={() => setScope('mine')}>
                Mis tareas
              </button>
              <button className={scope === 'team' ? 'on' : ''} onClick={() => setScope('team')}>
                Tareas del equipo
              </button>
            </div>
          )}
          {scope === 'team' && ledAreas.length > 1 && (
            <select className="select sm" style={{ width: 'auto' }} value={areaId} onChange={(e) => setAreaId(e.target.value)} aria-label="Filtrar por área">
              <option value="">Todas mis áreas</option>
              {ledAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          {isLeader && (
            <button className="btn dark" onClick={() => setEdit('new')}>
              <Plus /> Nueva tarea
            </button>
          )}
        </div>
      </div>

      <div className="kpis" style={{ marginBottom: 20 }}>
        <div className="kpi">
          <small>
            <ClipboardCheck /> Abiertas
          </small>
          <div className="v">{open.length}</div>
        </div>
        <div className="kpi">
          <small>
            <AlertTriangle /> Vencidas
          </small>
          <div className="v" style={{ color: overdue ? 'var(--critical)' : undefined }}>
            {overdue}
          </div>
        </div>
        <div className="kpi">
          <small>
            <Check /> Hechas
          </small>
          <div className="v">{tasks.filter((t) => t.status === 'DONE').length}</div>
        </div>
      </div>

      <label className="check" style={{ marginBottom: 10 }}>
        <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> Ver también las canceladas
      </label>

      {isLoading ? (
        <Loading />
      ) : !tasks.length ? (
        <div className="card">
          <Empty
            title={scope === 'mine' ? 'No tienes tareas asignadas' : 'Tu equipo no tiene tareas'}
            text={isLeader ? 'Crea una con “Nueva tarea” y asígnala a alguien de tu área.' : 'Cuando tu líder te asigne una, la verás aquí.'}
            icon={<ClipboardCheck />}
          />
        </div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', alignItems: 'start' }}>
          {COLUMNS.map((col) => {
            const list = tasks.filter((t) => t.status === col.key);
            return (
              <section key={col.key} className="card" aria-label={col.label} style={{ background: 'var(--card-2)', boxShadow: 'none', border: '1px solid var(--line)' }}>
                <div className="card-h" style={{ marginBottom: 12 }}>
                  <span className={`badge lg tone-${col.tone}`}>{col.label}</span>
                  <span className="xs faint">{list.length}</span>
                </div>
                <div className="stack">
                  {list.map((t) => (
                    <TaskCard key={t.id} t={t} team={scope === 'team'} onStart={() => setStatus(t, 'IN_PROGRESS')} onDone={() => setCompleting(t)} onEdit={() => setEdit(t)} onCancel={() => setStatus(t, 'CANCELLED')} onReopen={() => setStatus(t, 'TODO')} />
                  ))}
                  {!list.length && <div className="small faint" style={{ padding: '8px 4px' }}>Sin tareas.</div>}
                </div>
              </section>
            );
          })}
          {showCancelled && tasks.some((t) => t.status === 'CANCELLED') && (
            <section className="card" style={{ background: 'var(--card-2)', boxShadow: 'none', border: '1px solid var(--line)' }}>
              <div className="card-h" style={{ marginBottom: 12 }}>
                <span className="badge lg tone-gray">Canceladas</span>
              </div>
              <div className="stack">
                {tasks
                  .filter((t) => t.status === 'CANCELLED')
                  .map((t) => (
                    <TaskCard key={t.id} t={t} team={scope === 'team'} onStart={() => {}} onDone={() => {}} onEdit={() => {}} onCancel={() => {}} onReopen={() => setStatus(t, 'TODO')} />
                  ))}
              </div>
            </section>
          )}
        </div>
      )}

      {edit && <TaskModal task={edit === 'new' ? null : edit} areas={ledAreas} onClose={() => setEdit(null)} onSaved={refresh} />}
      {completing && (
        <CompleteModal
          task={completing}
          onClose={() => setCompleting(null)}
          onConfirm={async (note) => {
            await setStatus(completing, 'DONE', note);
            setCompleting(null);
          }}
        />
      )}
    </>
  );
}

function TaskCard({
  t,
  team,
  onStart,
  onDone,
  onEdit,
  onCancel,
  onReopen,
}: {
  t: Task;
  team: boolean;
  onStart: () => void;
  onDone: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onReopen: () => void;
}) {
  const p = t.permissions;
  return (
    <article className="card" style={{ padding: 16, boxShadow: 'var(--shadow)', opacity: t.status === 'CANCELLED' ? 0.65 : 1 }}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <b style={{ fontSize: 14, lineHeight: 1.3 }}>{t.title}</b>
        <PriorityBadge priority={t.priority as Priority} />
      </div>
      {t.description && (
        <p className="small muted" style={{ marginTop: 6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {t.description}
        </p>
      )}
      <div className="row wrap" style={{ marginTop: 10, gap: 6 }}>
        <span className="badge tone-gray">{t.area.name}</span>
        {t.dueDate && (
          <span className={`badge ${t.isOverdue ? 'tone-red' : 'tone-teal'}`}>
            {t.isOverdue ? <AlertTriangle /> : <CalendarDays />} {t.isOverdue ? 'Vencida · ' : ''}
            {fmtDayFull(t.dueDate)}
          </span>
        )}
        {t.status === 'DONE' && t.completedAt && <span className="badge tone-green">Cerrada {new Date(t.completedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}</span>}
      </div>
      {team && (
        <div className="row" style={{ marginTop: 10 }}>
          <Avatar name={t.assignee.name} size="sm" />
          <span className="small">{t.assignee.name}</span>
        </div>
      )}
      {!team && <div className="xs faint" style={{ marginTop: 8 }}>Asignada por {t.createdBy.name}</div>}
      {t.completionNote && (
        <div className="small muted" style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, background: 'var(--card-2)' }}>
          {t.completionNote}
        </div>
      )}
      <div className="row wrap" style={{ marginTop: 12, gap: 6 }}>
        {p.canWork && t.status === 'TODO' && (
          <button className="btn sm ghost" onClick={onStart}>
            <Play /> Iniciar
          </button>
        )}
        {p.canWork && (
          <button className="btn sm success" onClick={onDone}>
            <Check /> Completar
          </button>
        )}
        {p.canReopen && (
          <button className="btn sm outline" onClick={onReopen}>
            <RotateCcw /> Reabrir
          </button>
        )}
        <span style={{ flex: 1 }} />
        {p.canEdit && (
          <button className="icon-btn sm" onClick={onEdit} aria-label="Editar o reasignar">
            <Pencil />
          </button>
        )}
        {p.canCancel && (
          <button className="icon-btn sm" onClick={onCancel} aria-label="Cancelar tarea" title="Cancelar tarea">
            <X />
          </button>
        )}
      </div>
    </article>
  );
}

function CompleteModal({ task, onClose, onConfirm }: { task: Task; onClose: () => void; onConfirm: (note: string) => Promise<void> }) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title="Completar tarea"
      subtitle={task.title}
      icon={<Check />}
      onClose={onClose}
      footer={
        <>
          <button className="btn outline" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn success"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm(note);
              setBusy(false);
            }}
          >
            Marcar como hecha
          </button>
        </>
      }
    >
      <div className="field">
        <label>Nota de cierre (opcional)</label>
        <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="¿Qué hiciste? Tu líder la verá." autoFocus />
      </div>
    </Modal>
  );
}

function TaskModal({ task, areas, onClose, onSaved }: { task: Task | null; areas: Area[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    areaId: task?.areaId || areas[0]?.id || '',
    assigneeId: task?.assigneeId || '',
    title: task?.title || '',
    description: task?.description || '',
    priority: (task?.priority || 'MEDIUM') as Priority,
    dueDate: task?.dueDate || '',
  });
  const [busy, setBusy] = useState(false);
  const area = areas.find((a) => a.id === f.areaId);
  const people = area?.members ?? [];
  const reassigning = !!task && f.assigneeId !== task.assigneeId;

  const save = async () => {
    setBusy(true);
    try {
      if (task) {
        await api.patch(`/tasks/${task.id}`, { title: f.title, description: f.description, priority: f.priority, dueDate: f.dueDate || null, assigneeId: f.assigneeId });
      } else {
        await api.post('/tasks', { ...f, dueDate: f.dueDate || undefined, description: f.description || undefined });
      }
      toast(task ? 'Tarea actualizada' : 'Tarea creada y asignada');
      onSaved();
      onClose();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={task ? 'Editar tarea' : 'Nueva tarea'}
      subtitle="La persona asignada recibe una notificación y un correo."
      icon={<ClipboardCheck />}
      onClose={onClose}
      footer={
        <>
          <button className="btn outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn" disabled={busy || f.title.trim().length < 3 || !f.areaId || !f.assigneeId} onClick={save}>
            {task ? 'Guardar' : 'Crear tarea'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field full">
          <label>Título</label>
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus placeholder="Ej.: Actualizar el inventario de equipos" />
        </div>
        <div className="field">
          <label>Área</label>
          <select className="select" value={f.areaId} disabled={!!task} onChange={(e) => setF({ ...f, areaId: e.target.value, assigneeId: '' })}>
            {areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Asignar a</label>
          <select className="select" value={f.assigneeId} onChange={(e) => setF({ ...f, assigneeId: e.target.value })}>
            <option value="">Selecciona una persona</option>
            {people.map((m) => (
              <option key={m.user.id} value={m.user.id}>
                {m.user.name}
                {m.role === 'LEADER' ? ' (líder)' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Prioridad</label>
          <select className="select" value={f.priority} onChange={(e) => setF({ ...f, priority: e.target.value as Priority })}>
            {(Object.keys(PRIORITY) as Priority[]).map((p) => (
              <option key={p} value={p}>
                {PRIORITY[p].label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Fecha límite (opcional)</label>
          <input className="input" type="date" min={task ? undefined : todayYmd()} value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
        </div>
        <div className="field full">
          <label>Descripción</label>
          <textarea className="textarea" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Qué se espera, entregables, enlaces…" />
        </div>
        {reassigning && <div className="full small badge tone-amber" style={{ height: 'auto', padding: '8px 12px', borderRadius: 12 }}>Al reasignar, la tarea vuelve a “Por hacer” para la nueva persona.</div>}
      </div>
    </Modal>
  );
}
