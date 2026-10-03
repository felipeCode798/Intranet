import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock, Download, Inbox, ShieldAlert, Timer, TrendingUp } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Empty, Loading, ProgressRing, StatusBadge, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { fmtDate, hoursLabel } from '../../lib/format';
import type { RequestStatus } from '../../lib/types';

interface Group {
  id: string;
  name: string;
  total: number;
  open: number;
  resolved: number;
  onTime: number;
  late: number;
  overdue: number;
  avgResolutionHours: number;
  compliance: number | null;
  color?: string;
  isShared?: boolean;
}
interface Summary {
  kpis: { total: number; open: number; resolved: number; cancelled: number; overdue: number; resolvedOnTime: number; onTimeRate: number; avgResolutionHours: number; avgAcceptHours: number; escalated: number };
  byStatus: { status: RequestStatus; label: string; count: number }[];
  byMonth: { month: string; created: number; resolvedOnTime: number; resolvedLate: number }[];
  byArea: Group[];
  byCompany: Group[];
  byAssignee: Group[];
  byForm: Group[];
  byPriority: { priority: string; label: string; count: number }[];
  overdueList: { id: string; code: string; subject: string; area: string; company: string; assignee: string | null; status: RequestStatus; dueAt: string; daysLate: number }[];
}
interface Filters {
  areas: { id: string; name: string; isShared: boolean; companyIds: string[] }[];
  companies: { id: string; name: string; primaryColor: string }[];
}

const monthLabel = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('es-CO', { month: 'short', year: '2-digit' });
};

/** Tooltip con tokens del tema (el texto nunca usa el color de la serie) */
function VizTip({ active, payload, label, labelFmt }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="viz-tip">
      <b>{labelFmt ? labelFmt(label) : label}</b>
      {payload.map((p: any) => (
        <div className="ln" key={p.dataKey}>
          <span>
            <i style={{ background: p.color || p.fill }} /> {p.name}
          </span>
          <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

const axisTick = { fill: 'var(--ink-3)', fontSize: 12 };

export default function Reports() {
  const toast = useToast();
  const nav = useNavigate();
  const today = new Date();
  const [f, setF] = useState({
    companyId: '',
    areaId: '',
    from: new Date(today.getFullYear(), today.getMonth() - 5, 1).toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  });
  const { data: filters } = useQuery({ queryKey: ['report-filters'], queryFn: async () => (await api.get<Filters>('/reports/filters')).data });
  const params = { companyId: f.companyId || undefined, areaId: f.areaId || undefined, from: f.from || undefined, to: f.to || undefined };
  const { data, isLoading, error } = useQuery({ queryKey: ['report', params], queryFn: async () => (await api.get<Summary>('/reports/summary', { params })).data });

  const area = filters?.areas.find((a) => a.id === f.areaId);
  // En áreas compartidas se habilita el filtro por empresa
  const companyOptions = useMemo(() => {
    if (!filters) return [];
    if (area) return filters.companies.filter((c) => area.companyIds.includes(c.id));
    return filters.companies;
  }, [filters, area]);
  const showCompanyFilter = companyOptions.length > 1;

  const exportCsv = async () => {
    try {
      const res = await api.get('/reports/export', { params, responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `solicitudes-${f.from}-${f.to}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  const k = data?.kpis;
  const monthly = (data?.byMonth || []).map((m) => ({ ...m, month: monthLabel(m.month), resolved: m.resolvedOnTime + m.resolvedLate }));
  const areaRows = (data?.byArea || []).slice(0, 10).map((a) => ({ ...a }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Reportes de solicitudes</h1>
          <p className="page-sub">Cumplimiento de plazos, volumen y carga por área, empresa y responsable.</p>
        </div>
        <button className="btn dark" onClick={exportCsv} data-tour="rep-export">
          <Download /> Exportar CSV
        </button>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div className="filters">
          <select className="select sm" value={f.areaId} onChange={(e) => setF({ ...f, areaId: e.target.value, companyId: '' })} aria-label="Área" data-tour="rep-area">
            <option value="">Todas las áreas</option>
            {filters?.areas.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.isShared ? ' · compartida' : ''}
              </option>
            ))}
          </select>
          {showCompanyFilter && (
            <select className="select sm" value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })} aria-label="Empresa" data-tour="rep-company">
              <option value="">Todas las empresas</option>
              {companyOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <label className="row small muted" data-tour="rep-from">
            Desde <input className="input sm" type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} style={{ width: 150 }} />
          </label>
          <label className="row small muted" data-tour="rep-to">
            Hasta <input className="input sm" type="date" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} style={{ width: 150 }} />
          </label>
          <div className="tabs" style={{ marginLeft: 'auto' }} data-tour="rep-presets">
            {[
              ['30 d', 1],
              ['3 m', 3],
              ['6 m', 6],
              ['12 m', 12],
            ].map(([l, m]) => (
              <button
                key={l as string}
                onClick={() => {
                  const from = m === 1 ? new Date(Date.now() - 30 * 86400000) : new Date(today.getFullYear(), today.getMonth() - (m as number) + 1, 1);
                  setF({ ...f, from: from.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) });
                }}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <Loading />
      ) : error || !data || !k ? (
        <div className="card mt">{errorMessage(error)}</div>
      ) : (
        <>
          <div className="kpis mt" data-tour="rep-kpis">
            <div className="kpi">
              <small><Inbox /> Radicadas</small>
              <div className="v">{k.total}</div>
              <div className="sub">{k.open} abiertas · {k.cancelled} anuladas</div>
            </div>
            <div className="kpi">
              <small><CheckCircle2 /> Cumplimiento del plazo</small>
              <div className="v">{k.onTimeRate}%</div>
              <div className="sub">{k.resolvedOnTime} de {k.resolved} respondidas a tiempo</div>
            </div>
            <div className="kpi">
              <small><AlertTriangle /> Vencidas abiertas</small>
              <div className="v" style={{ color: k.overdue ? 'var(--critical)' : undefined }}>{k.overdue}</div>
              <div className="sub">Superaron el plazo y siguen sin respuesta</div>
            </div>
            <div className="kpi">
              <small><Timer /> Tiempo medio de respuesta</small>
              <div className="v">{hoursLabel(k.avgResolutionHours)}</div>
              <div className="sub">Desde la radicación</div>
            </div>
            <div className="kpi">
              <small><Clock /> Tiempo medio de aceptación</small>
              <div className="v">{hoursLabel(k.avgAcceptHours)}</div>
              <div className="sub">Desde la asignación</div>
            </div>
            <div className="kpi">
              <small><ShieldAlert /> Escalamientos</small>
              <div className="v">{k.escalated}</div>
              <div className="sub">Solicitados por colaboradores</div>
            </div>
          </div>

          {!k.total ? (
            <div className="card mt">
              <Empty title="Sin datos para estos filtros" text="Amplía el rango de fechas o cambia el área." />
            </div>
          ) : (
            <div className="chart-grid">
              <div className="card wide" data-tour="rep-monthly">
                <div className="card-h">
                  <h3>Radicadas vs. respondidas por mes</h3>
                  <div className="legend">
                    <span><i style={{ background: 'var(--series-1)' }} /> Radicadas</span>
                    <span><i style={{ background: 'var(--series-2)' }} /> Respondidas</span>
                  </div>
                </div>
                <div className="chart-box">
                  <ResponsiveContainer>
                    <LineChart data={monthly} margin={{ top: 10, right: 16, bottom: 0, left: -12 }}>
                      <CartesianGrid stroke="var(--grid)" vertical={false} />
                      <XAxis dataKey="month" tick={axisTick} axisLine={{ stroke: 'var(--axis)' }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                      <Tooltip content={<VizTip />} cursor={{ stroke: 'var(--axis)', strokeWidth: 1 }} />
                      <Line isAnimationActive={false} type="monotone" dataKey="created" name="Radicadas" stroke="var(--series-1)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'var(--card)' }} activeDot={{ r: 5 }} />
                      <Line isAnimationActive={false} type="monotone" dataKey="resolved" name="Respondidas" stroke="var(--series-2)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: 'var(--card)' }} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card" data-tour="rep-by-area">
                <div className="card-h">
                  <h3>Cumplimiento por área</h3>
                </div>
                <div className="legend" style={{ marginBottom: 8 }}>
                  <span className="status-mark"><CheckCircle2 color="var(--good)" /> A tiempo</span>
                  <span className="status-mark"><Clock color="var(--serious)" /> Fuera de plazo</span>
                  <span className="status-mark"><AlertTriangle color="var(--critical)" /> Vencidas abiertas</span>
                </div>
                <div className="chart-box" style={{ height: Math.max(220, areaRows.length * 42 + 30) }}>
                  <ResponsiveContainer>
                    <BarChart data={areaRows} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }} barCategoryGap={10}>
                      <CartesianGrid stroke="var(--grid)" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={130} tick={{ ...axisTick, fill: 'var(--ink-2)' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<VizTip />} cursor={{ fill: 'var(--p-soft)' }} />
                      <Bar isAnimationActive={false} maxBarSize={30} dataKey="onTime" name="A tiempo" stackId="a" fill="var(--good)" stroke="var(--card)" strokeWidth={2} />
                      <Bar isAnimationActive={false} maxBarSize={30} dataKey="late" name="Fuera de plazo" stackId="a" fill="var(--serious)" stroke="var(--card)" strokeWidth={2} />
                      <Bar isAnimationActive={false} maxBarSize={30} dataKey="overdue" name="Vencidas abiertas" stackId="a" fill="var(--critical)" stroke="var(--card)" strokeWidth={2} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card" data-tour="rep-by-company">
                <div className="card-h">
                  <h3>Solicitudes por empresa</h3>
                  <span className="xs faint">Haz clic para filtrar</span>
                </div>
                <div className="chart-box" style={{ height: Math.max(200, data.byCompany.length * 48 + 30) }}>
                  <ResponsiveContainer>
                    <BarChart data={data.byCompany} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }} barCategoryGap={12}>
                      <CartesianGrid stroke="var(--grid)" horizontal={false} />
                      <XAxis type="number" allowDecimals={false} tick={axisTick} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="name" width={100} tick={{ ...axisTick, fill: 'var(--ink-2)' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<VizTip />} cursor={{ fill: 'var(--p-soft)' }} />
                      <Bar
                        isAnimationActive={false}
                        maxBarSize={30}
                        dataKey="total"
                        name="Radicadas"
                        fill="var(--series-1)"
                        radius={[0, 4, 4, 0]}
                        cursor="pointer"
                        onClick={(d: any) => showCompanyFilter && setF({ ...f, companyId: d?.id || d?.payload?.id })}
                        label={{ position: 'right', fill: 'var(--ink-2)', fontSize: 12 }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card" data-tour="rep-status">
                <div className="card-h">
                  <h3>Estado actual</h3>
                </div>
                <div className="chart-box" style={{ height: 260 }}>
                  <ResponsiveContainer>
                    <BarChart data={data.byStatus} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 8 }} barCategoryGap={8}>
                      <XAxis type="number" hide allowDecimals={false} />
                      <YAxis type="category" dataKey="label" width={160} tick={{ ...axisTick, fill: 'var(--ink-2)' }} axisLine={false} tickLine={false} />
                      <Tooltip content={<VizTip />} cursor={{ fill: 'var(--p-soft)' }} />
                      <Bar isAnimationActive={false} maxBarSize={30} dataKey="count" name="Solicitudes" fill="var(--series-1)" radius={[0, 4, 4, 0]} label={{ position: 'right', fill: 'var(--ink-2)', fontSize: 12 }} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card" data-tour="rep-forms">
                <div className="card-h">
                  <h3>Tipos de solicitud más frecuentes</h3>
                </div>
                <div className="stack" style={{ gap: 10 }}>
                  {data.byForm.map((x) => (
                    <div key={x.id}>
                      <div className="row between small">
                        <span>{x.name}</span>
                        <b>{x.total}</b>
                      </div>
                      <div className="bar-inline" style={{ marginTop: 5 }}>
                        <i style={{ width: `${(x.total / data.byForm[0].total) * 100}%`, background: 'var(--series-1)', borderRadius: 4 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card wide" data-tour="rep-assignees">
                <div className="card-h">
                  <h3>Desempeño por responsable</h3>
                  <span className="xs faint"><TrendingUp size={13} style={{ verticalAlign: '-2px' }} /> Cumplimiento = respondidas a tiempo / respondidas</span>
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Responsable</th>
                        <th>Asignadas</th>
                        <th>Abiertas</th>
                        <th>Respondidas</th>
                        <th>Vencidas</th>
                        <th>Tiempo medio</th>
                        <th>Cumplimiento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byAssignee.map((a) => (
                        <tr key={a.id}>
                          <td className="bold">{a.name}</td>
                          <td>{a.total}</td>
                          <td>{a.open}</td>
                          <td>{a.resolved}</td>
                          <td>{a.overdue ? <span className="status-mark" style={{ color: 'var(--t-red)' }}><AlertTriangle /> {a.overdue}</span> : 0}</td>
                          <td>{a.resolved ? hoursLabel(a.avgResolutionHours) : '—'}</td>
                          <td>{a.compliance === null ? <span className="faint">—</span> : <div className="row"><ProgressRing pct={a.compliance} size={38} /></div>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card wide" data-tour="rep-overdue">
                <div className="card-h">
                  <h3>Solicitudes vencidas sin respuesta</h3>
                  <span className="badge tone-red"><AlertTriangle /> {data.overdueList.length}</span>
                </div>
                {data.overdueList.length ? (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Asunto</th>
                          <th>Área</th>
                          <th>Empresa</th>
                          <th>Responsable</th>
                          <th>Estado</th>
                          <th>Venció</th>
                          <th>Atraso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.overdueList.map((r) => (
                          <tr key={r.id} className="clickable overdue" onClick={() => nav(`/app/solicitudes/${r.id}`)}>
                            <td className="bold">{r.code}</td>
                            <td>{r.subject}</td>
                            <td>{r.area}</td>
                            <td>{r.company}</td>
                            <td>{r.assignee || <span className="faint">Sin asignar</span>}</td>
                            <td><StatusBadge status={r.status} /></td>
                            <td className="small">{fmtDate(r.dueAt)}</td>
                            <td><span className="status-mark" style={{ color: 'var(--t-red)' }}><AlertTriangle /> {r.daysLate} d</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <Empty title="Sin solicitudes vencidas" text="Todas las solicitudes abiertas están dentro del plazo." icon={<CheckCircle2 />} />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}
