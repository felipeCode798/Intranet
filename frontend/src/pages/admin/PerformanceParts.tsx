import { useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Clock, Gauge, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Modal, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { fmtMinutes, fmtPct, fmtValue, measureLabel, monthLabel, PERIOD_LABEL, periodText, shiftMonth, STATUS_INFO } from '../../lib/performance';
import { todayYmd } from '../../lib/schedule';
import type { CompanyTag, KpiResult, PerfRoleBoard, PerfTaskResult } from '../../lib/types';

export interface Range {
  from: string;
  to: string;
}

/** Selector del periodo que se mide: mes anterior / siguiente y fechas libres */
export function RangeBar({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  return (
    <div className="row wrap" style={{ gap: 8 }}>
      <button className="icon-btn sm" aria-label="Mes anterior" onClick={() => onChange(shiftMonth(range.from, -1))}>
        <ChevronLeft />
      </button>
      <b style={{ minWidth: 130, textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel(range.from)}</b>
      <button className="icon-btn sm" aria-label="Mes siguiente" onClick={() => onChange(shiftMonth(range.from, 1))}>
        <ChevronRight />
      </button>
      <input className="input sm" type="date" style={{ width: 'auto' }} value={range.from} max={range.to} onChange={(e) => e.target.value && onChange({ ...range, from: e.target.value })} aria-label="Desde" />
      <span className="xs faint">a</span>
      <input className="input sm" type="date" style={{ width: 'auto' }} value={range.to} min={range.from} onChange={(e) => e.target.value && onChange({ ...range, to: e.target.value })} aria-label="Hasta" />
    </div>
  );
}

export const CompanyDot = ({ c }: { c: CompanyTag }) => (
  <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 99, background: c.primaryColor, marginRight: 6 }} aria-hidden />
);

/** Indicadores del rol: meta, resultado del periodo y estado. `onMeasure` solo lo reciben quienes pueden medir (líder / administrador). */
export function KpiTable({ kpis, onMeasure }: { kpis: KpiResult[]; onMeasure?: (k: KpiResult) => void }) {
  if (!kpis.length) return <div className="small faint" style={{ padding: '10px 4px' }}>Este rol aún no tiene KPI definidos.</div>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>KPI</th>
            <th>Meta</th>
            <th>Resultado</th>
            <th>Estado</th>
            {onMeasure && <th aria-label="Acciones" />}
          </tr>
        </thead>
        <tbody>
          {kpis.map((k) => {
            const info = STATUS_INFO[k.summary.status];
            return (
              <tr key={k.id}>
                <td style={{ minWidth: 200 }}>
                  <b>{k.name}</b>
                  <div className="xs faint">{PERIOD_LABEL[k.period]}</div>
                </td>
                <td className="small">
                  {k.direction === 'HIGHER_BETTER' ? '≥' : '≤'} {fmtValue(k.target, k.unit)}
                </td>
                <td>
                  <b>{fmtValue(k.summary.average, k.unit)}</b>
                  {!!k.summary.count && <div className="xs faint">{k.summary.count} medición(es)</div>}
                </td>
                <td>
                  <span className={`badge ${info.tone}`}>{info.label}</span>
                  {k.summary.attainment !== null && <span className="xs faint" style={{ marginLeft: 6 }}>{fmtPct(k.summary.attainment)}</span>}
                </td>
                {onMeasure && (
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn sm ghost" onClick={() => onMeasure(k)}>
                      <Gauge /> Medir
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Tareas del rol y el tiempo dedicado a cada empresa que atiende el área */
export function TaskTable({ tasks, companies, onTime }: { tasks: PerfTaskResult[]; companies: CompanyTag[]; onTime: (t: PerfTaskResult) => void }) {
  if (!tasks.length) return <div className="small faint" style={{ padding: '10px 4px' }}>Este rol aún no tiene tareas definidas.</div>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Tarea</th>
            {companies.map((c) => (
              <th key={c.id} title={`Tiempo dedicado a ${c.name}`}>
                <CompanyDot c={c} />
                {c.name}
              </th>
            ))}
            <th>Total</th>
            <th aria-label="Acciones" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td style={{ minWidth: 220 }}>
                <b>{t.title}</b>
                {t.description && <div className="xs faint" style={{ marginTop: 2 }}>{t.description}</div>}
              </td>
              {companies.map((c) => (
                <td key={c.id}>{fmtMinutes(t.byCompany[c.id] || 0)}</td>
              ))}
              <td>
                <b>{fmtMinutes(t.minutes)}</b>
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="btn sm outline" onClick={() => onTime(t)}>
                  <Clock /> Tiempo
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Un rol medido: sus KPI (qué tan bien) y sus tareas (en qué y para quién se invirtió el tiempo) */
export function RoleBoard({
  role,
  companies,
  onTime,
  onMeasure,
}: {
  role: PerfRoleBoard;
  companies: CompanyTag[];
  onTime: (t: PerfTaskResult) => void;
  onMeasure?: (k: KpiResult) => void;
}) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div>
        <div className="label" style={{ marginBottom: 6 }}>
          Indicadores (KPI)
        </div>
        <KpiTable kpis={role.kpis} onMeasure={onMeasure} />
      </div>
      <div>
        <div className="label" style={{ marginBottom: 6 }}>
          Tareas y tiempo por empresa
        </div>
        <TaskTable tasks={role.tasks} companies={companies} onTime={onTime} />
      </div>
    </div>
  );
}

/** Registrar el tiempo dedicado a una tarea para una de las empresas que atiende el área */
export function TimeModal({
  task,
  companies,
  userId,
  userName,
  onClose,
}: {
  task: { id: string; title: string };
  companies: CompanyTag[];
  /** Solo cuando un líder registra a nombre de un colaborador */
  userId?: string;
  userName?: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [f, setF] = useState({ companyId: companies[0]?.id || '', date: todayYmd(), hours: '1', minutes: '0', note: '' });
  const [busy, setBusy] = useState(false);
  const total = (Number(f.hours) || 0) * 60 + (Number(f.minutes) || 0);

  const save = async () => {
    setBusy(true);
    try {
      await api.post('/performance/time', { taskId: task.id, companyId: f.companyId, date: f.date, minutes: total, note: f.note || undefined, userId });
      toast('Tiempo registrado');
      qc.invalidateQueries({ queryKey: ['performance'] });
      onClose();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Registrar tiempo"
      subtitle={userName ? `${task.title} · ${userName}` : task.title}
      icon={<Clock />}
      onClose={onClose}
      footer={
        <>
          <button className="btn outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn" disabled={busy || !f.companyId || total < 1 || total > 1440} onClick={save}>
            Guardar {total > 0 && `(${fmtMinutes(total)})`}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field full">
          <label>¿Para qué empresa trabajaste?</label>
          <select className="select" value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })}>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Fecha</label>
          <input className="input" type="date" max={todayYmd()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
        </div>
        <div className="field">
          <label>Tiempo dedicado</label>
          <div className="row" style={{ gap: 6 }}>
            <input className="input" type="number" min={0} max={24} value={f.hours} onChange={(e) => setF({ ...f, hours: e.target.value })} aria-label="Horas" style={{ width: 80 }} />
            <span className="small">h</span>
            <input className="input" type="number" min={0} max={59} step={5} value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value })} aria-label="Minutos" style={{ width: 80 }} />
            <span className="small">min</span>
          </div>
        </div>
        <div className="field full">
          <label>Nota (opcional)</label>
          <input className="input" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Ej.: Ajustes del módulo de pagos" />
        </div>
      </div>
    </Modal>
  );
}

/** Registrar (o corregir) el valor medido de un KPI para un colaborador en un periodo */
export function MeasureModal({ kpi, userId, userName, onClose }: { kpi: KpiResult; userId: string; userName: string; onClose: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [date, setDate] = useState(todayYmd());
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [gone, setGone] = useState<string[]>([]);
  const num = Number(value.replace(',', '.'));
  const valid = value.trim() !== '' && Number.isFinite(num) && num >= 0;

  const save = async () => {
    setBusy(true);
    try {
      await api.post('/performance/measures', { kpiId: kpi.id, userId, date, value: num, note: note || undefined });
      toast('Medición guardada');
      qc.invalidateQueries({ queryKey: ['performance'] });
      onClose();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/performance/measures/${id}`);
      setGone((g) => [...g, id]);
      qc.invalidateQueries({ queryKey: ['performance'] });
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const shown = kpi.measures.filter((m) => !gone.includes(m.id));
  return (
    <Modal
      title="Medir KPI"
      subtitle={`${kpi.name} · ${userName}`}
      icon={<Gauge />}
      onClose={onClose}
      footer={
        <>
          <button className="btn outline" onClick={onClose}>
            Cerrar
          </button>
          <button className="btn" disabled={busy || !valid} onClick={save}>
            Guardar medición
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field full small muted">
          Meta: <b>{kpi.direction === 'HIGHER_BETTER' ? '≥' : '≤'} {fmtValue(kpi.target, kpi.unit)}</b> · medición {kpi.period === 'DAILY' ? 'diaria' : kpi.period === 'WEEKLY' ? 'semanal' : 'mensual'}
        </div>
        <div className="field">
          <label>Un día del periodo</label>
          <input className="input" type="date" max={todayYmd()} value={date} onChange={(e) => setDate(e.target.value)} />
          <span className="help">Se guarda para {periodText(kpi.period, date)}. Si ya había una medición, se reemplaza.</span>
        </div>
        <div className="field">
          <label>Resultado{kpi.unit ? ` (${kpi.unit})` : ''}</label>
          <input className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} autoFocus placeholder={String(kpi.target)} />
        </div>
        <div className="field full">
          <label>Observación (opcional)</label>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {!!shown.length && (
          <div className="field full">
            <label>Mediciones del periodo consultado</label>
            <div className="stack" style={{ gap: 6 }}>
              {shown.map((m) => (
                <div key={m.id} className="row between small" style={{ padding: '6px 10px', borderRadius: 10, background: 'var(--card-2)' }}>
                  <span style={{ textTransform: 'capitalize' }}>{measureLabel(kpi.period, m.periodStart)}</span>
                  <b>{fmtValue(m.value, kpi.unit)}</b>
                  <button className="icon-btn sm" aria-label="Eliminar medición" onClick={() => remove(m.id)}>
                    <Trash2 />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
