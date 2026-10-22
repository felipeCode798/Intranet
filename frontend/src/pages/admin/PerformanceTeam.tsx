import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Clock, Layers, Target, Users } from 'lucide-react';
import { useState } from 'react';
import { Avatar, Empty, Loading, ProgressRing } from '../../components/ui';
import { api } from '../../lib/api';
import { fmtMinutes, scoreColor } from '../../lib/performance';
import type { CompanyTag, KpiResult, PerfCatalogArea, PerfOverview, PerfTaskResult, PerfTeam, PerfTeamMember } from '../../lib/types';
import { CompanyDot, MeasureModal, RangeBar, RoleBoard, TimeModal, type Range } from './PerformanceParts';

const ALL = 'all';

export default function PerformanceTeam({ areas, range, onRange }: { areas: PerfCatalogArea[]; range: Range; onRange: (r: Range) => void }) {
  const [areaId, setAreaId] = useState(areas.length > 1 ? ALL : areas[0]?.id || '');
  const [open, setOpen] = useState<string[]>([]);
  const [measure, setMeasure] = useState<{ kpi: KpiResult; user: PerfTeamMember['user'] } | null>(null);
  const [time, setTime] = useState<{ task: PerfTaskResult; user: PerfTeamMember['user']; companies: CompanyTag[] } | null>(null);

  const everything = areaId === ALL;
  const one = useQuery({
    queryKey: ['performance', 'team', areaId, range.from, range.to],
    queryFn: async () => (await api.get<PerfTeam>('/performance/team', { params: { areaId, ...range } })).data,
    enabled: !!areaId && !everything,
  });
  const all = useQuery({
    queryKey: ['performance', 'overview', range.from, range.to],
    queryFn: async () => (await api.get<PerfOverview>('/performance/overview', { params: range })).data,
    enabled: everything,
  });

  const loading = everything ? all.isLoading : one.isLoading;
  const teams: PerfTeam[] = everything ? (all.data?.areas ?? []) : one.data ? [one.data] : [];
  const withPeople = teams.filter((t) => t.members.length);
  const members = withPeople.flatMap((t) => t.members);
  const scored = members.filter((m) => m.score !== null);
  const avg = scored.length ? scored.reduce((a, m) => a + (m.score as number), 0) / scored.length : null;
  const totalMinutes = members.reduce((a, m) => a + m.totalMinutes, 0);
  const people = new Set(members.map((m) => m.user.id)).size;

  // Tiempo por empresa, sumando todas las áreas mostradas
  const byCompany = new Map<string, { c: CompanyTag; minutes: number }>();
  for (const t of withPeople)
    for (const c of t.area.companies) {
      const m = t.members.reduce((a, x) => a + (x.byCompany[c.id] || 0), 0);
      byCompany.set(c.id, { c, minutes: (byCompany.get(c.id)?.minutes || 0) + m });
    }

  const toggle = (key: string) => setOpen((o) => (o.includes(key) ? o.filter((x) => x !== key) : [...o, key]));
  const emptyAreas = teams.filter((t) => !t.members.length);

  return (
    <>
      <div className="row between wrap" style={{ marginBottom: 18 }}>
        <div className="row wrap">
          {areas.length > 1 && (
            <select className="select sm" style={{ width: 'auto' }} value={areaId} onChange={(e) => setAreaId(e.target.value)} aria-label="Área">
              <option value={ALL}>Todas las áreas</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          <RangeBar range={range} onChange={onRange} />
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="kpis" style={{ marginBottom: 20 }}>
            {everything && (
              <div className="kpi">
                <small>
                  <Layers /> Áreas con equipo medido
                </small>
                <div className="v">{withPeople.length}</div>
                <div className="sub small faint">de {teams.length} que gestionas</div>
              </div>
            )}
            <div className="kpi">
              <small>
                <Users /> Colaboradores medidos
              </small>
              <div className="v">{people}</div>
              <div className="sub small faint">Con un rol asignado</div>
            </div>
            <div className="kpi">
              <small>
                <Target /> Cumplimiento promedio
              </small>
              <div className="row" style={{ marginTop: 8 }}>
                {avg === null ? <div className="v">—</div> : <ProgressRing pct={Math.round(avg * 100)} color={scoreColor(avg)} />}
              </div>
            </div>
            <div className="kpi">
              <small>
                <Clock /> Tiempo registrado
              </small>
              <div className="v">{fmtMinutes(totalMinutes)}</div>
              <div className="sub small faint">
                {[...byCompany.values()].map(({ c, minutes }) => (
                  <span key={c.id} style={{ marginRight: 10, whiteSpace: 'nowrap' }}>
                    <CompanyDot c={c} />
                    {c.name}: {fmtMinutes(minutes)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {!withPeople.length ? (
            <div className="card">
              <Empty title="Nadie tiene un rol asignado" text="Crea los cargos, roles y tareas en “Cargos y KPI” y asigna a tu equipo para empezar a medirlo." icon={<Users />} />
            </div>
          ) : (
            <div className="stack" style={{ gap: 24 }}>
              {withPeople.map((t) => (
                <section key={t.area.id} aria-label={t.area.name}>
                  {everything && (
                    <div className="row between wrap" style={{ marginBottom: 10 }}>
                      <div className="row" style={{ gap: 10 }}>
                        <b style={{ fontSize: 17 }}>{t.area.name}</b>
                        <span className="xs faint">{t.members.length} colaborador(es)</span>
                      </div>
                      <div className="row wrap" style={{ gap: 6 }}>
                        {t.area.companies.map((c) => (
                          <span key={c.id} className="badge tone-gray">
                            <CompanyDot c={c} />
                            {c.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {!!t.unassigned.length && (
                    <div className="small badge tone-amber" style={{ height: 'auto', padding: '8px 12px', borderRadius: 12, marginBottom: 12, whiteSpace: 'normal' }}>
                      {t.unassigned.length} persona(s) de {t.area.name} aún no tienen un rol: {t.unassigned.map((u) => u.name).join(', ')}. Asígnalas en “Cargos y KPI”.
                    </div>
                  )}
                  <div className="stack">
                    {t.members.map((m) => {
                      const key = `${t.area.id}:${m.user.id}`;
                      const isOpen = open.includes(key) || (!everything && t.members.length === 1);
                      return (
                        <article key={key} className="card" style={{ padding: 0 }}>
                          <button className="row between wrap" style={{ width: '100%', padding: '16px 20px', textAlign: 'left', gap: 16 }} onClick={() => toggle(key)} aria-expanded={isOpen}>
                            <span className="row" style={{ gap: 12 }}>
                              {isOpen ? <ChevronDown /> : <ChevronRight />}
                              <Avatar name={m.user.name} url={m.user.avatarUrl} />
                              <span>
                                <b>{m.user.name}</b>
                                <span className="xs faint" style={{ display: 'block' }}>
                                  {m.roles.map((r) => `${r.name} (${r.positionName})`).join(' · ')}
                                </span>
                              </span>
                            </span>
                            <span className="row wrap" style={{ gap: 18 }}>
                              <span className="small">
                                <Clock style={{ width: 14, height: 14, verticalAlign: -2 }} /> <b>{fmtMinutes(m.totalMinutes)}</b>
                              </span>
                              {m.score === null ? <span className="badge tone-gray">Sin mediciones</span> : <ProgressRing pct={Math.round(m.score * 100)} size={48} color={scoreColor(m.score)} />}
                            </span>
                          </button>
                          {isOpen && (
                            <div className="stack" style={{ padding: '0 20px 20px', gap: 22 }}>
                              {m.roles.map((r) => (
                                <div key={r.id}>
                                  <div className="row between" style={{ marginBottom: 10 }}>
                                    <b>
                                      {r.name} <span className="small faint">· {r.positionName}</span>
                                    </b>
                                    {r.score !== null && <span className="badge tone-gray">Cumplimiento del rol: {Math.round(r.score * 100)} %</span>}
                                  </div>
                                  <RoleBoard
                                    role={r}
                                    companies={t.area.companies}
                                    onTime={(task) => setTime({ task, user: m.user, companies: t.area.companies })}
                                    onMeasure={(kpi) => setMeasure({ kpi, user: m.user })}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))}
              {everything && !!emptyAreas.length && (
                <div className="small faint">Sin roles asignados todavía: {emptyAreas.map((t) => t.area.name).join(', ')}.</div>
              )}
            </div>
          )}
        </>
      )}

      {measure && <MeasureModal kpi={measure.kpi} userId={measure.user.id} userName={measure.user.name} onClose={() => setMeasure(null)} />}
      {time && <TimeModal task={time.task} companies={time.companies} userId={time.user.id} userName={time.user.name} onClose={() => setTime(null)} />}
    </>
  );
}
