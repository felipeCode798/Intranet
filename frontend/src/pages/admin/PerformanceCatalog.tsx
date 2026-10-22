import { useQueryClient } from '@tanstack/react-query';
import { Gauge, Layers, ListChecks, Pencil, Plus, Trash2, UserPlus, UserRound } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Avatar, Empty, Modal, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { DIRECTION_LABEL, fmtValue, PERIOD_LABEL } from '../../lib/performance';
import type { Kpi, KpiDirection, KpiPeriod, PerfCatalogArea, PerfCatalogPosition, PerfCatalogRole, PerfCatalogTask } from '../../lib/types';
import { CompanyDot } from './PerformanceParts';

type Dialog =
  | { k: 'position'; item?: PerfCatalogPosition }
  | { k: 'role'; positionId: string; item?: PerfCatalogRole }
  | { k: 'task'; roleId: string; item?: PerfCatalogTask }
  | { k: 'kpi'; roleId: string; item?: Kpi }
  | { k: 'assign'; role: PerfCatalogRole };

export default function PerformanceCatalog({ areas }: { areas: PerfCatalogArea[] }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [areaId, setAreaId] = useState(areas[0]?.id || '');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const area = areas.find((a) => a.id === areaId) ?? areas[0];

  if (!area) {
    return (
      <div className="card">
        <Empty title="No perteneces a ninguna área" text="Cuando te sumen a un área verás sus cargos, roles, tareas e indicadores." icon={<Layers />} />
      </div>
    );
  }

  const can = area.canManage;
  const refresh = () => qc.invalidateQueries({ queryKey: ['performance'] });
  const remove = async (what: string, url: string) => {
    if (!window.confirm(`¿Eliminar ${what}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.delete(url);
      toast('Eliminado');
      refresh();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <>
      <div className="row between wrap" style={{ marginBottom: 18 }}>
        <div className="row wrap">
          {areas.length > 1 && (
            <select className="select sm" style={{ width: 'auto' }} value={area.id} onChange={(e) => setAreaId(e.target.value)} aria-label="Área">
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          <span className="small muted">Atiende a:</span>
          {area.companies.map((c) => (
            <span key={c.id} className="badge tone-gray">
              <CompanyDot c={c} />
              {c.name}
            </span>
          ))}
        </div>
        {can && (
          <button className="btn dark" onClick={() => setDialog({ k: 'position' })}>
            <Plus /> Nuevo cargo
          </button>
        )}
      </div>

      {!can && <div className="small muted" style={{ marginBottom: 14 }}>Consulta lo que se espera de cada rol de tu área. Solo el líder o un administrador puede modificarlo.</div>}

      {!area.positions.length ? (
        <div className="card">
          <Empty
            title="Esta área aún no tiene cargos"
            text={can ? 'Empieza creando un cargo (por ejemplo Junior, Semi o Senior); luego agrega los roles, sus tareas y los KPI.' : 'Su líder todavía no los ha definido.'}
            icon={<Layers />}
            action={can ? <button className="btn" onClick={() => setDialog({ k: 'position' })}><Plus /> Nuevo cargo</button> : undefined}
          />
        </div>
      ) : (
        <div className="stack" style={{ gap: 20 }}>
          {area.positions.map((p) => (
            <section key={p.id} className="card" style={{ opacity: p.active ? 1 : 0.65 }} aria-label={`Cargo ${p.name}`}>
              <div className="card-h" style={{ marginBottom: 14 }}>
                <div>
                  <b style={{ fontSize: 17 }}>{p.name}</b> {!p.active && <span className="badge tone-gray">Archivado</span>}
                  {p.description && <div className="small faint">{p.description}</div>}
                </div>
                {can && (
                  <div className="row" style={{ gap: 6 }}>
                    <button className="btn sm outline" onClick={() => setDialog({ k: 'role', positionId: p.id })}>
                      <Plus /> Rol
                    </button>
                    <IconBtn label="Editar cargo" onClick={() => setDialog({ k: 'position', item: p })}>
                      <Pencil />
                    </IconBtn>
                    <IconBtn label="Eliminar cargo" onClick={() => remove(`el cargo “${p.name}” con todos sus roles, tareas y KPI`, `/performance/positions/${p.id}`)}>
                      <Trash2 />
                    </IconBtn>
                  </div>
                )}
              </div>

              {!p.roles.length && <div className="small faint">Sin roles todavía.</div>}
              <div className="stack">
                {p.roles.map((r) => (
                  <div key={r.id} style={{ border: '1px solid var(--line)', borderRadius: 16, padding: 16, background: 'var(--card-2)', opacity: r.active ? 1 : 0.65 }}>
                    <div className="row between wrap" style={{ marginBottom: 10 }}>
                      <div>
                        <b>{r.name}</b> {!r.active && <span className="badge tone-gray">Archivado</span>}
                        {r.description && <div className="small faint">{r.description}</div>}
                      </div>
                      <div className="row wrap" style={{ gap: 6 }}>
                        {r.assignees.map((u) => (
                          <span key={u.id} className="row small" style={{ gap: 6 }} title={u.email}>
                            <Avatar name={u.name} url={u.avatarUrl} size="sm" />
                            {u.name}
                          </span>
                        ))}
                        {!r.assignees.length && (
                          <span className="small faint">
                            <UserRound style={{ width: 14, height: 14, verticalAlign: -2 }} /> Nadie asignado
                          </span>
                        )}
                        {can && (
                          <>
                            <button className="btn sm ghost" onClick={() => setDialog({ k: 'assign', role: r })}>
                              <UserPlus /> Asignar personas
                            </button>
                            <IconBtn label="Editar rol" onClick={() => setDialog({ k: 'role', positionId: p.id, item: r })}>
                              <Pencil />
                            </IconBtn>
                            <IconBtn label="Eliminar rol" onClick={() => remove(`el rol “${r.name}” con sus tareas y KPI`, `/performance/roles/${r.id}`)}>
                              <Trash2 />
                            </IconBtn>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="row between wrap" style={{ marginBottom: 6 }}>
                      <span className="label">Indicadores (KPI) del rol</span>
                      {can && (
                        <button className="btn sm ghost" onClick={() => setDialog({ k: 'kpi', roleId: r.id })}>
                          <Plus /> KPI
                        </button>
                      )}
                    </div>
                    <div className="row wrap" style={{ gap: 6, marginBottom: 16 }}>
                      {r.kpis.map((k) => {
                        const text = `${k.name} · ${k.direction === 'HIGHER_BETTER' ? '≥' : '≤'} ${fmtValue(k.target, k.unit)} · ${PERIOD_LABEL[k.period].toLowerCase()}`;
                        return can ? (
                          <button key={k.id} className={`badge ${k.active ? 'tone-violet' : 'tone-gray'}`} onClick={() => setDialog({ k: 'kpi', roleId: r.id, item: k })} title="Editar KPI">
                            <Gauge /> {text}
                          </button>
                        ) : (
                          <span key={k.id} className="badge tone-violet">
                            <Gauge /> {text}
                          </span>
                        );
                      })}
                      {!r.kpis.length && <span className="small faint">Sin KPI todavía.</span>}
                    </div>

                    <div className="label" style={{ marginBottom: 6 }}>
                      Tareas del rol
                    </div>
                    <div className="table-wrap" style={{ background: 'var(--card)' }}>
                      <table className="table">
                        <tbody>
                          {r.tasks.map((t) => (
                            <tr key={t.id} style={{ opacity: t.active ? 1 : 0.55 }}>
                              <td style={{ minWidth: 220 }}>
                                <ListChecks style={{ width: 14, height: 14, verticalAlign: -2, marginRight: 6, color: 'var(--ink-3)' }} />
                                {t.title}
                                {!t.active && <span className="badge tone-gray" style={{ marginLeft: 6 }}>Archivada</span>}
                                {t.description && <div className="xs faint">{t.description}</div>}
                              </td>
                              {can && (
                                <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                                  <IconBtn label="Editar tarea" onClick={() => setDialog({ k: 'task', roleId: r.id, item: t })}>
                                    <Pencil />
                                  </IconBtn>
                                  <IconBtn label="Eliminar tarea" onClick={() => remove(`la tarea “${t.title}”`, `/performance/tasks/${t.id}`)}>
                                    <Trash2 />
                                  </IconBtn>
                                </td>
                              )}
                            </tr>
                          ))}
                          {!r.tasks.length && (
                            <tr>
                              <td colSpan={can ? 2 : 1} className="small faint">
                                Este rol aún no tiene tareas.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {can && (
                      <button className="btn sm outline" style={{ marginTop: 10 }} onClick={() => setDialog({ k: 'task', roleId: r.id })}>
                        <Plus /> Agregar tarea
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {dialog?.k === 'position' && (
        <NameDialog
          title={dialog.item ? 'Editar cargo' : 'Nuevo cargo'}
          subtitle={`Área ${area.name}`}
          hint="Ej.: Junior, Semi, Senior, Administrador"
          initial={dialog.item}
          onClose={() => setDialog(null)}
          onSave={(v) => (dialog.item ? api.patch(`/performance/positions/${dialog.item.id}`, v) : api.post('/performance/positions', { ...v, areaId: area.id })).then(refresh)}
        />
      )}
      {dialog?.k === 'role' && (
        <NameDialog
          title={dialog.item ? 'Editar rol' : 'Nuevo rol'}
          hint="Ej.: Backend, Frontend, Full Stack, Analista, Bienestar"
          initial={dialog.item}
          onClose={() => setDialog(null)}
          onSave={(v) => (dialog.item ? api.patch(`/performance/roles/${dialog.item.id}`, v) : api.post('/performance/roles', { ...v, positionId: dialog.positionId })).then(refresh)}
        />
      )}
      {dialog?.k === 'task' && <TaskDialog dialog={dialog} onClose={() => setDialog(null)} onSaved={refresh} />}
      {dialog?.k === 'kpi' && <KpiDialog dialog={dialog} onClose={() => setDialog(null)} onSaved={refresh} />}
      {dialog?.k === 'assign' && <AssignDialog role={dialog.role} area={area} onClose={() => setDialog(null)} onSaved={refresh} />}
    </>
  );
}

const IconBtn = ({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) => (
  <button className="icon-btn sm" aria-label={label} title={label} onClick={onClick}>
    {children}
  </button>
);

/** Guarda con aviso de error y cierra al terminar */
function useSave(onClose: () => void) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok = 'Guardado') => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      onClose();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return { busy, run };
}

const Footer = ({ busy, disabled, onClose, onSave }: { busy: boolean; disabled: boolean; onClose: () => void; onSave: () => void }) => (
  <>
    <button className="btn outline" onClick={onClose}>
      Cancelar
    </button>
    <button className="btn" disabled={busy || disabled} onClick={onSave}>
      Guardar
    </button>
  </>
);

const ActiveField = ({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) => (
  <label className="check full">
    <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} /> Activo (si lo desmarcas se archiva y se conserva su historial)
  </label>
);

function NameDialog({
  title,
  subtitle,
  hint,
  initial,
  onClose,
  onSave,
}: {
  title: string;
  subtitle?: string;
  hint: string;
  initial?: { name: string; description?: string | null; active: boolean };
  onClose: () => void;
  onSave: (v: { name: string; description: string; active?: boolean }) => Promise<unknown>;
}) {
  const [f, setF] = useState({ name: initial?.name || '', description: initial?.description || '', active: initial?.active ?? true });
  const { busy, run } = useSave(onClose);
  return (
    <Modal title={title} subtitle={subtitle} icon={<Layers />} onClose={onClose} footer={<Footer busy={busy} disabled={f.name.trim().length < 2} onClose={onClose} onSave={() => run(() => onSave({ name: f.name, description: f.description, ...(initial ? { active: f.active } : {}) }))} />}>
      <div className="form-grid">
        <div className="field full">
          <label>Nombre</label>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus placeholder={hint} />
        </div>
        <div className="field full">
          <label>Descripción (opcional)</label>
          <textarea className="textarea" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        {initial && <ActiveField value={f.active} onChange={(active) => setF({ ...f, active })} />}
      </div>
    </Modal>
  );
}

function TaskDialog({ dialog, onClose, onSaved }: { dialog: Extract<Dialog, { k: 'task' }>; onClose: () => void; onSaved: () => void }) {
  const t = dialog.item;
  const [f, setF] = useState({ title: t?.title || '', description: t?.description || '', active: t?.active ?? true });
  const { busy, run } = useSave(onClose);
  const save = () =>
    run(async () => {
      if (t) await api.patch(`/performance/tasks/${t.id}`, { title: f.title, description: f.description, active: f.active });
      else await api.post('/performance/tasks', { roleId: dialog.roleId, title: f.title, description: f.description });
      onSaved();
    });
  return (
    <Modal title={t ? 'Editar tarea' : 'Nueva tarea del rol'} subtitle="Lo que se espera que haga quien desempeña el rol." icon={<ListChecks />} onClose={onClose} footer={<Footer busy={busy} disabled={f.title.trim().length < 3} onClose={onClose} onSave={save} />}>
      <div className="form-grid">
        <div className="field full">
          <label>Tarea</label>
          <input className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} autoFocus placeholder="Ej.: Desarrollar y mantener los servicios del módulo de pagos" />
        </div>
        <div className="field full">
          <label>Descripción (opcional)</label>
          <textarea className="textarea" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        {t && <ActiveField value={f.active} onChange={(active) => setF({ ...f, active })} />}
      </div>
    </Modal>
  );
}

function KpiDialog({ dialog, onClose, onSaved }: { dialog: Extract<Dialog, { k: 'kpi' }>; onClose: () => void; onSaved: () => void }) {
  const k = dialog.item;
  const [f, setF] = useState({
    name: k?.name || '',
    description: k?.description || '',
    unit: k?.unit ?? '%',
    target: k ? String(k.target) : '',
    direction: (k?.direction || 'HIGHER_BETTER') as KpiDirection,
    period: (k?.period || 'MONTHLY') as KpiPeriod,
    active: k?.active ?? true,
  });
  const { busy, run } = useSave(onClose);
  const target = Number(f.target.replace(',', '.'));
  const valid = f.name.trim().length >= 2 && f.target.trim() !== '' && Number.isFinite(target) && target >= 0;
  const save = () =>
    run(async () => {
      const body = { name: f.name, description: f.description, unit: f.unit.trim(), target, direction: f.direction, period: f.period };
      if (k) await api.patch(`/performance/kpis/${k.id}`, { ...body, active: f.active });
      else await api.post('/performance/kpis', { ...body, roleId: dialog.roleId });
      onSaved();
    });
  return (
    <Modal title={k ? 'Editar KPI' : 'Nuevo KPI'} subtitle="El indicador con el que se mide a quien desempeña este rol." icon={<Gauge />} onClose={onClose} footer={<Footer busy={busy} disabled={!valid} onClose={onClose} onSave={save} />}>
      <div className="form-grid">
        <div className="field full">
          <label>Nombre del KPI</label>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus placeholder="Ej.: Entregas a tiempo" />
        </div>
        <div className="field">
          <label>Meta</label>
          <input className="input" inputMode="decimal" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} placeholder="90" />
        </div>
        <div className="field">
          <label>Unidad</label>
          <input className="input" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="%, tickets, horas…" maxLength={20} />
        </div>
        <div className="field">
          <label>¿Qué es mejor?</label>
          <select className="select" value={f.direction} onChange={(e) => setF({ ...f, direction: e.target.value as KpiDirection })}>
            {(Object.keys(DIRECTION_LABEL) as KpiDirection[]).map((d) => (
              <option key={d} value={d}>
                {DIRECTION_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Se mide</label>
          <select className="select" value={f.period} onChange={(e) => setF({ ...f, period: e.target.value as KpiPeriod })}>
            {(Object.keys(PERIOD_LABEL) as KpiPeriod[]).map((p) => (
              <option key={p} value={p}>
                {PERIOD_LABEL[p]}
              </option>
            ))}
          </select>
        </div>
        <div className="field full">
          <label>Cómo se calcula (opcional)</label>
          <textarea className="textarea" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        {k && <ActiveField value={f.active} onChange={(active) => setF({ ...f, active })} />}
      </div>
    </Modal>
  );
}

function AssignDialog({ role, area, onClose, onSaved }: { role: PerfCatalogRole; area: PerfCatalogArea; onClose: () => void; onSaved: () => void }) {
  const [sel, setSel] = useState<string[]>(role.assignees.map((u) => u.id));
  const { busy, run } = useSave(onClose);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <Modal
      title="Asignar personas al rol"
      subtitle={`${role.name} · ${area.name}`}
      icon={<UserPlus />}
      onClose={onClose}
      footer={<Footer busy={busy} disabled={false} onClose={onClose} onSave={() => run(async () => { await api.put(`/performance/roles/${role.id}/members`, { userIds: sel }); onSaved(); })} />}
    >
      <div className="stack" style={{ gap: 2 }}>
        {area.members.map(({ user, role: ar }) => (
          <label key={user.id} className="check" style={{ padding: '8px 4px' }}>
            <input type="checkbox" checked={sel.includes(user.id)} onChange={() => toggle(user.id)} />
            <Avatar name={user.name} url={user.avatarUrl} size="sm" />
            <span>
              {user.name} {ar === 'LEADER' && <span className="xs faint">(líder)</span>}
            </span>
          </label>
        ))}
        {!area.members.length && <div className="small faint">El área no tiene miembros todavía.</div>}
      </div>
    </Modal>
  );
}
