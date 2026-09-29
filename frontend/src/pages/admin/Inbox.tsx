import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { RequestDetail } from '../../components/RequestDetail';
import { Avatar, Empty, Loading, PriorityBadge, SlaBadge, SlaBar, StatusBadge } from '../../components/ui';
import { api } from '../../lib/api';
import { fmtDate, STATUS } from '../../lib/format';
import type { Area, CompanyBrief, Paged, RequestItem, RequestStatus } from '../../lib/types';

type Tab = 'assigned' | 'area' | 'all' | 'mine';

export default function Inbox() {
  const { isSuper, isCompanyAdmin, isLeader, leaderAreaIds } = useAuth();
  const [sp, setSp] = useSearchParams();
  const nav = useNavigate();
  const tab = (sp.get('tab') as Tab) || (isLeader ? 'area' : 'assigned');
  const status = sp.get('status') || '';
  const areaId = sp.get('areaId') || '';
  const companyId = sp.get('companyId') || '';
  const overdue = sp.get('overdue') === 'true';
  const page = Number(sp.get('page') || 1);
  const [q, setQ] = useState(sp.get('q') || '');
  useEffect(() => setQ(sp.get('q') || ''), [sp]);

  const set = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(sp);
    Object.entries(patch).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
    if (!('page' in patch)) n.delete('page');
    setSp(n);
  };

  const { data: areas = [] } = useQuery({ queryKey: ['areas', 'mine'], queryFn: async () => (await api.get<Area[]>('/areas/mine')).data });
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: async () => (await api.get<CompanyBrief[]>('/companies')).data });
  const ledAreas = isSuper ? areas : areas.filter((a) => leaderAreaIds.includes(a.id));
  const selectedArea = areas.find((a) => a.id === areaId);
  const showCompany = tab === 'all' ? isSuper : tab === 'area' && (!areaId ? ledAreas.some((a) => a.isShared) : selectedArea?.isShared);

  const { data, isLoading } = useQuery({
    queryKey: ['requests', tab, status, areaId, companyId, overdue, sp.get('q'), page],
    queryFn: async () =>
      (
        await api.get<Paged<RequestItem>>('/requests', {
          params: { scope: tab, status: status || undefined, areaId: areaId || undefined, companyId: companyId || undefined, overdue: overdue || undefined, q: sp.get('q') || undefined, page, pageSize: 15 },
        })
      ).data,
  });

  const tabs: { k: Tab; label: string; show: boolean }[] = [
    { k: 'area', label: 'Mis áreas', show: isLeader },
    { k: 'assigned', label: 'Asignadas a mí', show: true },
    { k: 'all', label: isSuper ? 'Todo el holding' : 'Mi empresa', show: isSuper || isCompanyAdmin },
    { k: 'mine', label: 'Radicadas por mí', show: true },
  ];
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Bandeja de solicitudes</h1>
          <p className="page-sub">Gestiona las solicitudes según tu rol. Las atrasadas se marcan en rojo.</p>
        </div>
        <div className="tabs">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button key={t.k} className={tab === t.k ? 'on' : ''} onClick={() => setSp(new URLSearchParams({ tab: t.k }))}>
                {t.label}
              </button>
            ))}
        </div>
      </div>

      <div className="card">
        <div className="filters" style={{ marginBottom: 16 }}>
          <form
            className="row"
            onSubmit={(e) => {
              e.preventDefault();
              set({ q: q || null });
            }}
            style={{ position: 'relative' }}
          >
            <Search size={16} className="faint" style={{ position: 'absolute', left: 12 }} />
            <input className="input sm" style={{ paddingLeft: 36, minWidth: 240 }} placeholder="Código, asunto o solicitante" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <select className="select sm" value={status} onChange={(e) => set({ status: e.target.value || null })}>
            <option value="">Todos los estados</option>
            {(Object.keys(STATUS) as RequestStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS[s].label}
              </option>
            ))}
          </select>
          {tab === 'area' && ledAreas.length > 1 && (
            <select className="select sm" value={areaId} onChange={(e) => set({ areaId: e.target.value || null, companyId: null })}>
              <option value="">Todas mis áreas</option>
              {ledAreas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          {showCompany && (
            <select className="select sm" value={companyId} onChange={(e) => set({ companyId: e.target.value || null })}>
              <option value="">Todas las empresas</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <button className={`btn sm ${overdue ? 'danger' : 'outline'}`} onClick={() => set({ overdue: overdue ? null : 'true' })}>
            <AlertTriangle /> Solo vencidas
          </button>
          <span className="small faint" style={{ marginLeft: 'auto' }}>
            {data?.total ?? 0} resultado(s)
          </span>
        </div>

        {isLoading ? (
          <Loading />
        ) : data?.items.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Solicitud</th>
                  <th>Área · Empresa</th>
                  <th>Solicitante</th>
                  <th>Responsable</th>
                  <th>Estado</th>
                  <th>Prioridad</th>
                  <th>Plazo consumido</th>
                  <th>Vencimiento</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((r) => (
                  <tr key={r.id} className={`clickable ${r.isOverdue ? 'overdue' : ''}`} onClick={() => nav(`/app/solicitudes/${r.id}`)}>
                    <td style={{ maxWidth: 280 }}>
                      <div className="bold">{r.subject}</div>
                      <div className="xs faint">
                        {r.code} · {r.form.name} · {fmtDate(r.createdAt)}
                      </div>
                    </td>
                    <td>
                      <div>{r.area.name}</div>
                      <div className="xs faint row" style={{ gap: 5 }}>
                        <span className="dot" style={{ background: r.company.primaryColor }} /> {r.company.name}
                      </div>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <Avatar name={r.requester.name} size="sm" /> <span className="small">{r.requester.name}</span>
                      </div>
                    </td>
                    <td className="small">{r.assignee?.name || <span className="faint">Sin asignar</span>}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>
                      <PriorityBadge priority={r.priority} />
                    </td>
                    <td>{['RESOLVED', 'CANCELLED'].includes(r.status) ? <span className="faint">—</span> : <SlaBar progress={r.slaProgress} />}</td>
                    <td>
                      <SlaBadge r={r} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="No hay solicitudes" text="Prueba con otros filtros." />
        )}
        {pages > 1 && (
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="round-btn" disabled={page <= 1} onClick={() => set({ page: String(page - 1) })} aria-label="Anterior">
              <ChevronLeft />
            </button>
            <span className="small">
              Página {page} de {pages}
            </span>
            <button className="round-btn" disabled={page >= pages} onClick={() => set({ page: String(page + 1) })} aria-label="Siguiente">
              <ChevronRight />
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export function AdminRequestPage() {
  const { id = '' } = useParams();
  return (
    <>
      <div className="row" style={{ margin: '14px 0 18px' }}>
        <Link className="btn ghost sm" to="/app/bandeja">
          <ArrowLeft /> Bandeja
        </Link>
      </div>
      <RequestDetail id={id} />
    </>
  );
}
