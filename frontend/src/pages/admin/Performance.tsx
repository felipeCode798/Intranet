import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, Gauge, Target, Trash2, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Empty, Loading, ProgressRing, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { fmtDayFull } from '../../lib/schedule';
import { fmtMinutes, monthRange, scoreColor } from '../../lib/performance';
import type { PerfCatalogArea, PerfMe, PerfTaskResult } from '../../lib/types';
import PerformanceCatalog from './PerformanceCatalog';
import { CompanyDot, RangeBar, RoleBoard, TimeModal, type Range } from './PerformanceParts';
import PerformanceTeam from './PerformanceTeam';

type Tab = 'me' | 'team' | 'catalog';

export default function Performance() {
  const [tab, setTab] = useState<Tab>('me');
  const [range, setRange] = useState<Range>(() => monthRange());
  const { data: catalog = [], isLoading } = useQuery({
    queryKey: ['performance', 'catalog'],
    queryFn: async () => (await api.get<PerfCatalogArea[]>('/performance/catalog')).data,
  });
  const managed = catalog.filter((a) => a.canManage);

  useEffect(() => {
    if (tab === 'team' && !isLoading && !managed.length) setTab('me');
  }, [tab, isLoading, managed.length]);

  // Quien gestiona varias áreas (p. ej. el superadministrador) entra directo a la vista de todo el equipo
  const landed = useRef(false);
  useEffect(() => {
    if (landed.current || isLoading) return;
    landed.current = true;
    if (managed.length > 1) setTab('team');
  }, [isLoading, managed.length]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Desempeño</h1>
          <p className="page-sub">Cargos, roles y tareas de cada área, los KPI con los que se miden y el tiempo dedicado a cada empresa.</p>
        </div>
        <div className="tabs" role="tablist" data-tour="perf-tabs">
          <button role="tab" aria-selected={tab === 'me'} className={tab === 'me' ? 'on' : ''} onClick={() => setTab('me')}>
            <Target /> Mi desempeño
          </button>
          {!!managed.length && (
            <button role="tab" aria-selected={tab === 'team'} className={tab === 'team' ? 'on' : ''} onClick={() => setTab('team')}>
              <Users /> Equipo
            </button>
          )}
          <button role="tab" aria-selected={tab === 'catalog'} className={tab === 'catalog' ? 'on' : ''} onClick={() => setTab('catalog')}>
            <Gauge /> Cargos y KPI
          </button>
        </div>
      </div>

      {isLoading ? (
        <Loading />
      ) : tab === 'me' ? (
        <MyPerformance range={range} onRange={setRange} />
      ) : tab === 'team' ? (
        <PerformanceTeam areas={managed} range={range} onRange={setRange} />
      ) : (
        <PerformanceCatalog areas={catalog} />
      )}
    </>
  );
}

function MyPerformance({ range, onRange }: { range: Range; onRange: (r: Range) => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [timeFor, setTimeFor] = useState<{ task: PerfTaskResult; companies: PerfMe['roles'][number]['area']['companies'] } | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ['performance', 'me', range.from, range.to],
    queryFn: async () => (await api.get<PerfMe>('/performance/me', { params: range })).data,
  });

  const removeEntry = async (id: string) => {
    try {
      await api.delete(`/performance/time/${id}`);
      toast('Registro eliminado');
      qc.invalidateQueries({ queryKey: ['performance'] });
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <>
      <div className="row between wrap" style={{ marginBottom: 18 }}>
        <RangeBar range={range} onChange={onRange} />
      </div>

      {isLoading || !data ? (
        <Loading />
      ) : !data.roles.length ? (
        <div className="card">
          <Empty
            title="Aún no tienes un rol asignado"
            text="Tu líder te asigna un rol en “Cargos y KPI”. Desde ahí verás tus tareas, tus indicadores y podrás registrar el tiempo que dedicas a cada empresa."
            icon={<Target />}
          />
        </div>
      ) : (
        <>
          <div className="kpis" style={{ marginBottom: 20 }}>
            <div className="kpi">
              <small>
                <Target /> Cumplimiento de KPI
              </small>
              <div className="row" style={{ marginTop: 8 }}>
                {data.score === null ? <div className="v">—</div> : <ProgressRing pct={Math.round(data.score * 100)} color={scoreColor(data.score)} />}
              </div>
              <div className="sub small faint">{data.score === null ? 'Aún sin mediciones en el periodo' : 'Promedio de los KPI medidos'}</div>
            </div>
            <div className="kpi">
              <small>
                <Clock /> Tiempo registrado
              </small>
              <div className="v">{fmtMinutes(data.totalMinutes)}</div>
              <div className="sub small faint">En el periodo seleccionado</div>
            </div>
            <div className="kpi">
              <small>
                <Gauge /> Roles
              </small>
              <div className="v">{data.roles.length}</div>
              <div className="sub small faint">{data.roles.map((r) => r.name).join(' · ')}</div>
            </div>
          </div>

          <div className="stack" style={{ gap: 20 }}>
            {data.roles.map((r) => (
              <section key={r.id} className="card" aria-label={`${r.area.name} · ${r.position.name} · ${r.name}`}>
                <div className="card-h" style={{ marginBottom: 12 }}>
                  <div>
                    <b style={{ fontSize: 16 }}>{r.name}</b>
                    <div className="small faint">
                      {r.area.name} · {r.position.name}
                    </div>
                  </div>
                  <div className="row wrap" style={{ gap: 6 }}>
                    {r.area.companies.map((c) => (
                      <span key={c.id} className="badge tone-gray">
                        <CompanyDot c={c} />
                        {c.name}
                      </span>
                    ))}
                  </div>
                </div>
                <RoleBoard role={r} companies={r.area.companies} onTime={(task) => setTimeFor({ task, companies: r.area.companies })} />
              </section>
            ))}
          </div>

          <section className="card" style={{ marginTop: 20 }}>
            <div className="card-h" style={{ marginBottom: 12 }}>
              <b>Mis registros de tiempo</b>
              <span className="xs faint">{data.entries.length}</span>
            </div>
            {!data.entries.length ? (
              <div className="small faint">Todavía no registras tiempo en este periodo. Usa el botón “Tiempo” de cada tarea.</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tarea</th>
                      <th>Empresa</th>
                      <th>Tiempo</th>
                      <th>Nota</th>
                      <th aria-label="Acciones" />
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.map((e) => (
                      <tr key={e.id}>
                        <td>{fmtDayFull(e.date)}</td>
                        <td>{e.taskTitle}</td>
                        <td>
                          <CompanyDot c={e.company} />
                          {e.company.name}
                        </td>
                        <td>
                          <b>{fmtMinutes(e.minutes)}</b>
                        </td>
                        <td className="small muted">
                          {e.note}
                          {e.loggedByOther && <span className="badge tone-gray" style={{ marginLeft: 6 }}>Registrado por tu líder</span>}
                        </td>
                        <td>
                          <button className="icon-btn sm" aria-label="Eliminar registro" onClick={() => removeEntry(e.id)}>
                            <Trash2 />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {timeFor && <TimeModal task={timeFor.task} companies={timeFor.companies} onClose={() => setTimeFor(null)} />}
    </>
  );
}
