import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ChevronLeft, ChevronRight, Copy, Moon, Plus, Repeat, Settings2, Trash2, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Avatar, Empty, Loading, Modal, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { LEAVE_LABEL } from '../../lib/leaves';
import {
  addDays,
  crossesMidnight,
  dailyPattern,
  eachDay,
  type EntryInput,
  fixedPattern,
  fmtDayLong,
  fmtDayShort,
  mondayOf,
  MODE_INFO,
  rotatingPattern,
  shiftLabel,
  todayYmd,
  weeklyPattern,
  WEEKDAYS,
  WEEKDAYS_LONG,
  weekdayIdx,
} from '../../lib/schedule';
import type { Area, AreaSchedule, LeaveSpan, MySchedule, ScheduleEntry, ScheduleMode, ShiftTemplate } from '../../lib/types';

const tint = (c: string) => ({ background: `color-mix(in srgb, ${c} 16%, transparent)`, color: c, boxShadow: `inset 3px 0 0 ${c}` });
const REST_COLOR = '#9998b3';

export default function Schedules() {
  const { isLeader } = useAuth();
  const [tab, setTab] = useState<'mine' | 'manage'>('mine');
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Horarios</h1>
          <p className="page-sub">{isLeader ? 'Consulta tu horario y arma el de tu equipo: fijo, diario, semanal o rotativo.' : 'Tu horario de trabajo asignado por tu líder.'}</p>
        </div>
        {isLeader && (
          <div className="tabs">
            <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>
              Mi horario
            </button>
            <button className={tab === 'manage' ? 'on' : ''} onClick={() => setTab('manage')}>
              Gestionar horarios
            </button>
          </div>
        )}
      </div>
      {tab === 'mine' ? <MySchedulePanel /> : <ManagePanel />}
    </>
  );
}

function WeekNav({ weekStart, onChange }: { weekStart: string; onChange: (s: string) => void }) {
  return (
    <div className="row">
      <button className="icon-btn sm" onClick={() => onChange(addDays(weekStart, -7))} aria-label="Semana anterior">
        <ChevronLeft />
      </button>
      <b className="small" style={{ minWidth: 190, textAlign: 'center' }}>
        {fmtDayShort(weekStart)} – {fmtDayShort(addDays(weekStart, 6))}
      </b>
      <button className="icon-btn sm" onClick={() => onChange(addDays(weekStart, 7))} aria-label="Semana siguiente">
        <ChevronRight />
      </button>
      <button className="btn sm outline" onClick={() => onChange(mondayOf(todayYmd()))}>
        Hoy
      </button>
    </div>
  );
}

const leaveOn = (leaves: LeaveSpan[], day: string, userId?: string) =>
  leaves.find((l) => (!userId || l.userId === userId) && l.status !== 'CANCELLED' && l.startDate <= day && l.endDate >= day);

// ------------------------------------------------------------------ mi horario
function MySchedulePanel() {
  const [weekStart, setWeekStart] = useState(mondayOf(todayYmd()));
  const to = addDays(weekStart, 6);
  const { data, isLoading } = useQuery({
    queryKey: ['schedules', 'me', weekStart, to],
    queryFn: async () => (await api.get<MySchedule>('/schedules/me', { params: { from: weekStart, to } })).data,
  });
  const byDay = new Map((data?.entries ?? []).map((e) => [e.date, e]));
  const today = todayYmd();

  return (
    <>
      <div className="row between wrap" style={{ marginBottom: 16 }}>
        <WeekNav weekStart={weekStart} onChange={setWeekStart} />
      </div>
      {isLoading ? (
        <Loading />
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
          {eachDay(weekStart, to).map((day) => {
            const e = byDay.get(day);
            const leave = data && leaveOn(data.leaves, day);
            const color = e?.isRest ? REST_COLOR : e?.template?.color || '#6457f5';
            return (
              <div key={day} className="card" style={{ padding: 16, outline: day === today ? '2px solid var(--p)' : undefined }}>
                <div className="xs faint" style={{ textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  {WEEKDAYS_LONG[weekdayIdx(day)]}
                </div>
                <b style={{ fontSize: 18 }}>{fmtDayShort(day)}</b>
                <div style={{ marginTop: 12 }}>
                  {e ? (
                    <div style={{ ...tint(color), padding: '10px 12px', borderRadius: 12 }}>
                      <b className="small" style={{ display: 'block' }}>
                        {e.isRest ? 'Descanso' : e.template?.name || 'Turno'}
                      </b>
                      {!e.isRest && (
                        <span className="xs" style={{ opacity: 0.85 }}>
                          {shiftLabel(e)}
                          {crossesMidnight(e.startTime, e.endTime) && <Moon size={11} style={{ display: 'inline', marginLeft: 4, verticalAlign: '-1px' }} />}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="small faint" style={{ padding: '10px 0' }}>Sin horario</div>
                  )}
                  {e?.area && <div className="xs faint" style={{ marginTop: 6 }}>{e.area.name}</div>}
                  {leave && (
                    <span className={`badge ${leave.status === 'APPROVED' ? 'tone-blue' : 'tone-amber'}`} style={{ marginTop: 8 }}>
                      {LEAVE_LABEL[leave.type]} · {leave.status === 'APPROVED' ? 'aprobado' : 'pendiente'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ gestión (líderes)
function ManagePanel() {
  const { isSuper, leaderAreaIds } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [areaId, setAreaId] = useState('');
  const [weekStart, setWeekStart] = useState(mondayOf(todayYmd()));
  const [cell, setCell] = useState<{ userId: string; name: string; date: string } | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showPattern, setShowPattern] = useState(false);

  const { data: areas = [], isLoading: loadingAreas } = useQuery({ queryKey: ['areas', 'mine'], queryFn: async () => (await api.get<Area[]>('/areas/mine')).data });
  const led = areas.filter((a) => isSuper || leaderAreaIds.includes(a.id));
  const currentId = areaId || led[0]?.id || '';
  const to = addDays(weekStart, 6);

  const { data, isLoading } = useQuery({
    queryKey: ['schedules', 'area', currentId, weekStart, to],
    queryFn: async () => (await api.get<AreaSchedule>(`/schedules/areas/${currentId}`, { params: { from: weekStart, to } })).data,
    enabled: !!currentId,
  });

  const entryMap = useMemo(() => new Map((data?.entries ?? []).map((e) => [`${e.userId}|${e.date}`, e])), [data]);
  const refresh = () => qc.invalidateQueries({ queryKey: ['schedules'] });

  /** Envía las asignaciones en bloques (el API admite hasta 3000 por petición) */
  const apply = async (entries: EntryInput[]) => {
    let saved = 0;
    let cleared = 0;
    const skipped: { reason: string }[] = [];
    for (let i = 0; i < entries.length; i += 2500) {
      const { data: r } = await api.put<{ saved: number; cleared: number; skipped: { reason: string }[] }>(`/schedules/areas/${currentId}/entries`, { entries: entries.slice(i, i + 2500) });
      saved += r.saved;
      cleared += r.cleared;
      skipped.push(...r.skipped);
    }
    refresh();
    return { saved, cleared, skipped };
  };

  const report = (r: { saved: number; cleared: number; skipped: { reason: string }[] }) => {
    const reasons = [...new Set(r.skipped.map((s) => s.reason))].join('; ');
    toast(`${r.saved} asignado(s)${r.cleared ? `, ${r.cleared} quitado(s)` : ''}${r.skipped.length ? ` · ${r.skipped.length} omitido(s): ${reasons}` : ''}`, r.skipped.length ? 'error' : 'ok');
  };

  const changeMode = async (mode: ScheduleMode) => {
    try {
      await api.patch(`/schedules/areas/${currentId}/mode`, { mode });
      refresh();
      toast(`Tipo de horario: ${MODE_INFO[mode].label}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const copyPrevious = async () => {
    try {
      const prev = addDays(weekStart, -7);
      const { data: p } = await api.get<AreaSchedule>(`/schedules/areas/${currentId}`, { params: { from: prev, to: addDays(prev, 6) } });
      const active = new Set(data?.templates.map((t) => t.id));
      const entries: EntryInput[] = p.entries.map((e) => ({
        userId: e.userId,
        date: addDays(e.date, 7),
        ...(e.templateId && active.has(e.templateId) ? { templateId: e.templateId } : { isRest: e.isRest, startTime: e.startTime ?? undefined, endTime: e.endTime ?? undefined }),
      }));
      if (!entries.length) return toast('La semana anterior no tiene horarios para copiar', 'error');
      report(await apply(entries));
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  if (loadingAreas) return <Loading />;
  if (!led.length) return <div className="card"><Empty title="No lideras ningún área" icon={<CalendarClock />} /></div>;

  return (
    <>
      <div className="row between wrap" style={{ marginBottom: 16, gap: 12 }}>
        <div className="row wrap">
          <select className="select sm" style={{ width: 'auto' }} value={currentId} onChange={(e) => setAreaId(e.target.value)} aria-label="Área">
            {led.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <WeekNav weekStart={weekStart} onChange={setWeekStart} />
        </div>
        <div className="row wrap">
          <button className="btn sm outline" onClick={() => setShowTemplates(true)}>
            <Settings2 /> Turnos del área
          </button>
          <button className="btn sm outline" onClick={copyPrevious}>
            <Copy /> Copiar semana anterior
          </button>
          <button className="btn sm dark" onClick={() => setShowPattern(true)} disabled={!data?.templates.length}>
            <Wand2 /> Asignar con patrón
          </button>
        </div>
      </div>

      {data && (
        <div className="card" style={{ marginBottom: 16, padding: 18 }}>
          <div className="label" style={{ marginBottom: 8 }}>Tipo de horario de {data.area.name}</div>
          <div className="options-grid">
            {(Object.keys(MODE_INFO) as ScheduleMode[]).map((m) => (
              <label key={m} className={`opt-pill ${data.area.scheduleMode === m ? 'on' : ''}`} title={MODE_INFO[m].description}>
                <input type="radio" name="mode" checked={data.area.scheduleMode === m} onChange={() => changeMode(m)} /> {MODE_INFO[m].label}
              </label>
            ))}
          </div>
          <p className="xs faint" style={{ marginTop: 8 }}>{MODE_INFO[data.area.scheduleMode].description}</p>
        </div>
      )}

      {isLoading || !data ? (
        <Loading />
      ) : !data.templates.length ? (
        <div className="card">
          <Empty
            title="Primero define los turnos del área"
            text="Crea turnos como Mañana, Tarde, Noche o Descanso; luego los asignas a cada persona."
            icon={<CalendarClock />}
            action={
              <button className="btn" onClick={() => setShowTemplates(true)}>
                <Plus /> Crear turnos
              </button>
            }
          />
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap" style={{ border: 0 }}>
            <table className="table" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 190 }}>Persona</th>
                  {eachDay(weekStart, to).map((d) => (
                    <th key={d} style={d === todayYmd() ? { color: 'var(--p)' } : undefined}>
                      {WEEKDAYS[weekdayIdx(d)]} {fmtDayShort(d).split(' ')[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <div className="row">
                        <Avatar name={m.name} url={m.avatarUrl} size="sm" />
                        <div>
                          <div className="bold small">{m.name}</div>
                          <div className="xs faint">{m.role === 'LEADER' ? 'Líder' : m.jobTitle || 'Colaborador'}</div>
                        </div>
                      </div>
                    </td>
                    {eachDay(weekStart, to).map((d) => {
                      const e = entryMap.get(`${m.id}|${d}`);
                      const leave = leaveOn(data.leaves, d, m.id);
                      return (
                        <td key={d} style={{ padding: 6 }}>
                          <button
                            className="block"
                            style={{ width: '100%', minHeight: 46, borderRadius: 10, padding: '5px 8px', textAlign: 'left', fontSize: 12, ...(e ? tint(e.isRest ? REST_COLOR : e.template?.color || '#6457f5') : { border: '1px dashed var(--line-2)', color: 'var(--ink-3)' }) }}
                            onClick={() => setCell({ userId: m.id, name: m.name, date: d })}
                            aria-label={`${m.name}, ${fmtDayLong(d)}: ${e ? shiftLabel(e) : 'sin horario'}`}
                          >
                            {e ? (
                              <>
                                <b style={{ display: 'block' }}>{e.isRest ? 'Descanso' : e.template?.name || 'Turno'}</b>
                                {!e.isRest && <span style={{ opacity: 0.85 }}>{e.startTime}–{e.endTime}</span>}
                              </>
                            ) : (
                              '+'
                            )}
                          </button>
                          {leave && (
                            <span className={`badge ${leave.status === 'APPROVED' ? 'tone-blue' : 'tone-amber'}`} style={{ marginTop: 4, height: 20, fontSize: 10.5 }} title={LEAVE_LABEL[leave.type]}>
                              Permiso{leave.status === 'PENDING' ? '?' : ''}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {cell && data && (
        <CellModal
          cell={cell}
          current={entryMap.get(`${cell.userId}|${cell.date}`)}
          templates={data.templates}
          onClose={() => setCell(null)}
          onApply={async (entry) => {
            try {
              report(await apply([{ userId: cell.userId, date: cell.date, ...entry }]));
              setCell(null);
            } catch (e) {
              toast(errorMessage(e), 'error');
            }
          }}
        />
      )}
      {showTemplates && data && <TemplatesModal areaId={currentId} templates={data.templates} onClose={() => setShowTemplates(false)} onChanged={refresh} />}
      {showPattern && data && (
        <PatternModal
          data={data}
          weekStart={weekStart}
          onClose={() => setShowPattern(false)}
          onApply={async (entries) => {
            try {
              report(await apply(entries));
              setShowPattern(false);
            } catch (e) {
              toast(errorMessage(e), 'error');
            }
          }}
        />
      )}
    </>
  );
}

// ------------------------------------------------------------------ editar un día
function CellModal({
  cell,
  current,
  templates,
  onClose,
  onApply,
}: {
  cell: { userId: string; name: string; date: string };
  current?: ScheduleEntry;
  templates: ShiftTemplate[];
  onClose: () => void;
  onApply: (e: Partial<EntryInput>) => Promise<void>;
}) {
  const [custom, setCustom] = useState({ startTime: current?.startTime || '08:00', endTime: current?.endTime || '17:00' });
  const [busy, setBusy] = useState(false);
  const run = async (e: Partial<EntryInput>) => {
    setBusy(true);
    await onApply(e);
    setBusy(false);
  };
  return (
    <Modal title={cell.name} subtitle={fmtDayLong(cell.date)} icon={<CalendarClock />} onClose={onClose}>
      <div className="stack">
        <div className="stack" style={{ gap: 6 }}>
          {templates.map((t) => (
            <button key={t.id} disabled={busy} className="select-card" style={{ ...tint(t.isRest ? REST_COLOR : t.color), border: 0, justifyContent: 'space-between' }} onClick={() => run({ templateId: t.id })}>
              <b>{t.name}</b>
              <small>{t.isRest ? 'Día libre' : `${t.startTime} – ${t.endTime}`}</small>
            </button>
          ))}
        </div>
        <div className="divider" style={{ margin: '4px 0' }} />
        <div className="label">Horario personalizado</div>
        <div className="row">
          <input className="input" type="time" value={custom.startTime} onChange={(e) => setCustom({ ...custom, startTime: e.target.value })} />
          <span>–</span>
          <input className="input" type="time" value={custom.endTime} onChange={(e) => setCustom({ ...custom, endTime: e.target.value })} />
          <button className="btn" disabled={busy || !custom.startTime || !custom.endTime || custom.startTime === custom.endTime} onClick={() => run(custom)}>
            Aplicar
          </button>
        </div>
        {current && (
          <button className="btn danger" disabled={busy} onClick={() => run({ clear: true })}>
            <Trash2 /> Quitar horario de este día
          </button>
        )}
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ turnos del área
function TemplatesModal({ areaId, templates, onClose, onChanged }: { areaId: string; templates: ShiftTemplate[]; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ name: '', startTime: '08:00', endTime: '17:00', color: '#6457f5', isRest: false });
  const [busy, setBusy] = useState(false);
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast(ok);
      onChanged();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  const palette = ['#6457f5', '#1d4ed8', '#0f766e', '#d97706', '#db2777', '#4338ca'];
  return (
    <Modal title="Turnos del área" subtitle="Son los bloques que luego asignas a cada persona." icon={<Settings2 />} onClose={onClose} wide>
      <div className="stack">
        {templates.length ? (
          <div className="stack" style={{ gap: 6 }}>
            {templates.map((t) => (
              <div key={t.id} className="row" style={{ ...tint(t.isRest ? REST_COLOR : t.color), padding: '8px 12px', borderRadius: 12 }}>
                <b style={{ flex: 1 }}>{t.name}</b>
                <span className="small">{t.isRest ? 'Día libre' : `${t.startTime} – ${t.endTime}`}</span>
                {!t.isRest && crossesMidnight(t.startTime, t.endTime) && <span className="badge tone-violet"><Moon /> Cruza medianoche</span>}
                <button className="icon-btn sm" disabled={busy} aria-label={`Quitar ${t.name}`} onClick={() => act(() => api.patch(`/schedules/templates/${t.id}`, { active: false }), 'Turno quitado')}>
                  <Trash2 />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="small faint">Aún no hay turnos. Crea el primero abajo.</p>
        )}
        <div className="divider" style={{ margin: '4px 0' }} />
        <div className="label">Nuevo turno</div>
        <div className="form-grid">
          <div className="field">
            <label>Nombre</label>
            <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={f.isRest ? 'Descanso' : 'Mañana, Tarde, Noche…'} />
          </div>
          <div className="field">
            <label>Color</label>
            <div className="row" style={{ gap: 6 }}>
              {palette.map((c) => (
                <button key={c} type="button" aria-label={c} onClick={() => setF({ ...f, color: c })} style={{ width: 26, height: 26, borderRadius: '50%', background: c, boxShadow: f.color === c ? `0 0 0 3px var(--card), 0 0 0 5px ${c}` : undefined }} />
              ))}
            </div>
          </div>
          {!f.isRest && (
            <>
              <div className="field">
                <label>Entrada</label>
                <input className="input" type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} />
              </div>
              <div className="field">
                <label>Salida</label>
                <input className="input" type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} />
                {crossesMidnight(f.startTime, f.endTime) && f.startTime !== f.endTime && <span className="help">Termina al día siguiente (turno nocturno).</span>}
              </div>
            </>
          )}
          <label className="check full">
            <input type="checkbox" checked={f.isRest} onChange={(e) => setF({ ...f, isRest: e.target.checked })} /> Es un día de descanso (sin horario)
          </label>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button
            className="btn"
            disabled={busy || f.name.trim().length < 2 || (!f.isRest && f.startTime === f.endTime)}
            onClick={() =>
              act(async () => {
                await api.post(`/schedules/areas/${areaId}/templates`, f.isRest ? { name: f.name, isRest: true, color: f.color } : f);
                setF({ ...f, name: '' });
              }, 'Turno creado')
            }
          >
            <Plus /> Agregar turno
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ asistente de patrones
function PatternModal({ data, weekStart, onClose, onApply }: { data: AreaSchedule; weekStart: string; onClose: () => void; onApply: (e: EntryInput[]) => Promise<void> }) {
  const work = data.templates.filter((t) => !t.isRest);
  const rest = data.templates.find((t) => t.isRest);
  const [mode, setMode] = useState<ScheduleMode>(data.area.scheduleMode);
  const [people, setPeople] = useState<string[]>(data.members.map((m) => m.id));
  const [from, setFrom] = useState(weekStart);
  const [to, setTo] = useState(addDays(weekStart, 27));
  const [templateId, setTemplateId] = useState(work[0]?.id || '');
  const [weekdays, setWeekdays] = useState([0, 1, 2, 3, 4]);
  const [restOthers, setRestOthers] = useState(!!rest);
  const [perWeekday, setPerWeekday] = useState<string[]>(['', '', '', '', '', '', '']);
  const [perWeek, setPerWeek] = useState<string[]>([]);
  const [steps, setSteps] = useState<{ templateId: string; days: number }[]>(
    work.length ? [...work.slice(0, 3).map((t) => ({ templateId: t.id, days: 2 })), ...(rest ? [{ templateId: rest.id, days: 1 }] : [])] : [],
  );
  const [stagger, setStagger] = useState(0);
  const [busy, setBusy] = useState(false);

  const weeks = Math.max(1, Math.min(26, Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${mondayOf(from)}T00:00:00Z`)) / (7 * 86400000)) + 1));
  const weekValue = (i: number) => perWeek[i] ?? work[i % Math.max(1, work.length)]?.id ?? '';

  const entries = useMemo<EntryInput[]>(() => {
    if (!people.length || to < from) return [];
    const base = { userIds: people, from, to };
    const restId = restOthers ? rest?.id : undefined;
    if (mode === 'FIXED') return templateId ? fixedPattern({ ...base, templateId, weekdays, restId }) : [];
    if (mode === 'DAILY') return dailyPattern({ ...base, perWeekday });
    if (mode === 'WEEKLY') return weeklyPattern({ ...base, perWeek: Array.from({ length: weeks }, (_, i) => weekValue(i)), weekdays, restId });
    return rotatingPattern({ ...base, steps, stagger });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, people, from, to, templateId, weekdays, restOthers, perWeekday, perWeek, steps, stagger, weeks]);

  const cycle = steps.reduce((n, s) => n + (s.days > 0 ? s.days : 0), 0);
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const tplOptions = (withEmpty?: string) => (
    <>
      {withEmpty !== undefined && <option value="">{withEmpty}</option>}
      {data.templates.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name}
          {t.isRest ? '' : ` (${t.startTime}–${t.endTime})`}
        </option>
      ))}
    </>
  );
  const weekdayPicker = (
    <div className="field">
      <label>Días de trabajo</label>
      <div className="options-grid">
        {WEEKDAYS.map((w, i) => (
          <label key={w} className={`opt-pill ${weekdays.includes(i) ? 'on' : ''}`}>
            <input type="checkbox" checked={weekdays.includes(i)} onChange={() => setWeekdays(toggle(weekdays, i))} /> {w}
          </label>
        ))}
      </div>
      {rest && (
        <label className="check">
          <input type="checkbox" checked={restOthers} onChange={(e) => setRestOthers(e.target.checked)} /> Marcar los demás días como descanso
        </label>
      )}
    </div>
  );

  return (
    <Modal
      title="Asignar con patrón"
      subtitle="Genera varios días de una vez. Reemplaza lo que ya exista en esas fechas."
      icon={<Wand2 />}
      wide
      onClose={onClose}
      footer={
        <>
          <span className="small faint" style={{ marginRight: 'auto', alignSelf: 'center' }}>
            {entries.length ? `${entries.length} turno(s) para ${people.length} persona(s)` : 'Completa el patrón para continuar'}
          </span>
          <button className="btn outline" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn"
            disabled={busy || !entries.length}
            onClick={async () => {
              setBusy(true);
              await onApply(entries);
              setBusy(false);
            }}
          >
            Aplicar horario
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="tabs">
          {(Object.keys(MODE_INFO) as ScheduleMode[]).map((m) => (
            <button key={m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)}>
              {MODE_INFO[m].label}
            </button>
          ))}
        </div>
        <p className="small muted">{MODE_INFO[mode].description}</p>

        <div className="form-grid">
          <div className="field">
            <label>Desde</label>
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="field">
            <label>Hasta</label>
            <input className="input" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div className="field">
          <label>Personas</label>
          <div className="options-grid">
            <label className={`opt-pill ${people.length === data.members.length ? 'on' : ''}`}>
              <input type="checkbox" checked={people.length === data.members.length} onChange={(e) => setPeople(e.target.checked ? data.members.map((m) => m.id) : [])} /> Todas
            </label>
            {data.members.map((m) => (
              <label key={m.id} className={`opt-pill ${people.includes(m.id) ? 'on' : ''}`}>
                <input type="checkbox" checked={people.includes(m.id)} onChange={() => setPeople(toggle(people, m.id))} /> {m.name}
              </label>
            ))}
          </div>
        </div>

        {mode === 'FIXED' && (
          <>
            <div className="field">
              <label>Turno</label>
              <select className="select" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                {work.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.startTime}–{t.endTime})
                  </option>
                ))}
              </select>
            </div>
            {weekdayPicker}
          </>
        )}

        {mode === 'DAILY' && (
          <div className="field">
            <label>Turno de cada día de la semana</label>
            <div className="form-grid">
              {WEEKDAYS_LONG.map((d, i) => (
                <div key={d} className="row">
                  <span className="small" style={{ width: 86 }}>{d}</span>
                  <select className="select sm" value={perWeekday[i]} onChange={(e) => setPerWeekday(perWeekday.map((v, j) => (j === i ? e.target.value : v)))}>
                    {tplOptions('Sin asignar')}
                  </select>
                </div>
              ))}
            </div>
            <span className="help">Para cambiar día por día con total libertad, usa la cuadrícula; esto sirve para repetir una semana tipo.</span>
          </div>
        )}

        {mode === 'WEEKLY' && (
          <>
            <div className="field">
              <label>Turno de cada semana ({weeks} semana{weeks > 1 ? 's' : ''})</label>
              <div className="form-grid">
                {Array.from({ length: weeks }, (_, i) => (
                  <div key={i} className="row">
                    <span className="small" style={{ width: 130 }}>Semana del {fmtDayShort(addDays(mondayOf(from), i * 7))}</span>
                    <select className="select sm" value={weekValue(i)} onChange={(e) => setPerWeek(Array.from({ length: weeks }, (_, k) => (k === i ? e.target.value : weekValue(k))))}>
                      {data.templates.filter((t) => !t.isRest).map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({t.startTime}–{t.endTime})
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
            {weekdayPicker}
          </>
        )}

        {mode === 'ROTATING' && (
          <>
            <div className="field">
              <label>Secuencia que se repite{cycle ? ` (ciclo de ${cycle} días)` : ''}</label>
              <div className="stack" style={{ gap: 6 }}>
                {steps.map((s, i) => (
                  <div key={i} className="row">
                    <span className="xs faint" style={{ width: 18 }}>{i + 1}.</span>
                    <select className="select sm" value={s.templateId} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, templateId: e.target.value } : x)))}>
                      {tplOptions()}
                    </select>
                    <input className="input sm" style={{ width: 80 }} type="number" min={1} max={31} value={s.days} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, days: Math.max(1, Number(e.target.value) || 1) } : x)))} aria-label="Días seguidos" />
                    <span className="small faint">día(s)</span>
                    <button className="icon-btn sm" onClick={() => setSteps(steps.filter((_, j) => j !== i))} aria-label="Quitar paso">
                      <Trash2 />
                    </button>
                  </div>
                ))}
                <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setSteps([...steps, { templateId: data.templates[0]?.id || '', days: 1 }])}>
                  <Plus /> Agregar paso
                </button>
              </div>
            </div>
            <div className="field">
              <label>
                <Repeat size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> Desfase entre personas (días)
              </label>
              <input className="input" style={{ maxWidth: 140 }} type="number" min={0} max={30} value={stagger} onChange={(e) => setStagger(Math.max(0, Number(e.target.value) || 0))} />
              <span className="help">0 = todas con el mismo turno. Con 2, cada persona empieza la secuencia 2 días después de la anterior, para que siempre haya cobertura.</span>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
