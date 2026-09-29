import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, Globe, Network, Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Avatar, Empty, Loading, Modal, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { Icon, ICONS } from '../../lib/icons';
import type { Area, AreaRole, CompanyBrief, DirectoryUser } from '../../lib/types';

export default function Areas() {
  const { isSuper, isCompanyAdmin, user, leaderAreaIds } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: all = [], isLoading } = useQuery({ queryKey: ['areas', 'all'], queryFn: async () => (await api.get<Area[]>('/areas')).data });
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: async () => (await api.get<CompanyBrief[]>('/companies')).data });
  const [edit, setEdit] = useState<Area | 'new' | null>(null);
  const [adding, setAdding] = useState<Area | null>(null);
  const [filter, setFilter] = useState('');

  const canAdmin = (a: Area) => isSuper || (isCompanyAdmin && !a.isShared && a.companies.some((c) => c.company.id === user?.companyId));
  const visible = all.filter((a) => canAdmin(a) || leaderAreaIds.includes(a.id)).filter((a) => !filter || a.companies.some((c) => c.company.id === filter));

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['areas'] });
    qc.invalidateQueries({ queryKey: ['intranet'] });
  };
  const setRole = async (a: Area, userId: string, role: AreaRole) => {
    try {
      await api.post(`/areas/${a.id}/members`, { userId, role });
      refresh();
      toast(role === 'LEADER' ? 'Ahora es líder del área' : 'Ahora es colaborador');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const remove = async (a: Area, userId: string) => {
    try {
      await api.delete(`/areas/${a.id}/members/${userId}`);
      refresh();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  if (isLoading) return <Loading />;
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Áreas</h1>
          <p className="page-sub">Las áreas compartidas (como Calidad y Jurídica) atienden a varias empresas; las propias solo a la suya.</p>
        </div>
        <div className="row">
          {isSuper && (
            <select className="select sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">Todas las empresas</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          {(isSuper || isCompanyAdmin) && (
            <button className="btn dark" onClick={() => setEdit('new')}>
              <Plus /> Nueva área
            </button>
          )}
        </div>
      </div>
      {!visible.length && <div className="card"><Empty title="No hay áreas para gestionar" icon={<Network />} /></div>}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))' }}>
        {visible.map((a) => (
          <div className="card" key={a.id}>
            <div className="card-h" style={{ alignItems: 'flex-start' }}>
              <div className="row" style={{ alignItems: 'flex-start' }}>
                <span className="ico-box">
                  <Icon name={a.icon} />
                </span>
                <div>
                  <h3>{a.name}</h3>
                  <div className="row wrap" style={{ gap: 5, marginTop: 4 }}>
                    {a.isShared && (
                      <span className="badge tone-violet">
                        <Globe /> Compartida
                      </span>
                    )}
                    {a.companies.map((c) => (
                      <span key={c.company.id} className="badge tone-gray">
                        <span className="dot" style={{ background: c.company.primaryColor }} /> {c.company.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {canAdmin(a) && (
                <button className="icon-btn sm" onClick={() => setEdit(a)} aria-label="Editar área">
                  <Pencil />
                </button>
              )}
            </div>
            {a.description && <p className="small muted" style={{ marginBottom: 12 }}>{a.description}</p>}
            <div className="xs faint" style={{ marginBottom: 8 }}>
              {a._count?.forms ?? 0} formulario(s) · {a._count?.requests ?? 0} solicitud(es)
            </div>
            <div className="stack" style={{ gap: 8 }}>
              {a.members.map((m) => (
                <div key={m.id} className="row" style={{ padding: '8px 10px', borderRadius: 12, background: 'var(--card-2)' }}>
                  <Avatar name={m.user.name} size="sm" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="small bold">{m.user.name}</div>
                    <div className="xs faint">{m.user.jobTitle || m.user.email}</div>
                  </div>
                  {m.role === 'LEADER' ? (
                    <span className="badge tone-amber">
                      <Crown /> Líder
                    </span>
                  ) : (
                    <span className="badge tone-gray">Colaborador</span>
                  )}
                  {canAdmin(a) && (
                    <button className="btn sm outline" style={{ height: 28 }} onClick={() => setRole(a, m.user.id, m.role === 'LEADER' ? 'MEMBER' : 'LEADER')}>
                      {m.role === 'LEADER' ? 'Quitar líder' : 'Hacer líder'}
                    </button>
                  )}
                  {(canAdmin(a) || m.role === 'MEMBER') && (
                    <button className="icon-btn sm" onClick={() => remove(a, m.user.id)} aria-label="Quitar del área">
                      <Trash2 />
                    </button>
                  )}
                </div>
              ))}
              {!a.members.length && <div className="small faint">Sin miembros todavía.</div>}
              <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setAdding(a)}>
                <UserPlus /> Agregar persona
              </button>
            </div>
          </div>
        ))}
      </div>
      {edit && <AreaModal area={edit === 'new' ? null : edit} companies={companies} onClose={() => setEdit(null)} onSaved={refresh} />}
      {adding && <AddMemberModal area={adding} canLead={canAdmin(adding)} onClose={() => setAdding(null)} onSaved={refresh} />}
    </>
  );
}

function AreaModal({ area, companies, onClose, onSaved }: { area: Area | null; companies: CompanyBrief[]; onClose: () => void; onSaved: () => void }) {
  const { isSuper, user } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({
    name: area?.name || '',
    description: area?.description || '',
    icon: area?.icon || 'folder',
    isShared: area?.isShared || false,
    companyIds: area?.companies.map((c) => c.company.id) || (user?.companyId && !isSuper ? [user.companyId] : []),
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      if (area) await api.patch(`/areas/${area.id}`, isSuper ? f : { name: f.name, description: f.description, icon: f.icon });
      else await api.post('/areas', f);
      toast(area ? 'Área actualizada' : 'Área creada');
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
      title={area ? 'Editar área' : 'Nueva área'}
      onClose={onClose}
      icon={<Network />}
      footer={
        <>
          <button className="btn outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn" disabled={busy || f.name.trim().length < 2 || !f.companyIds.length} onClick={save}>
            Guardar
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="field">
          <label>Nombre</label>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div className="field">
          <label>Descripción</label>
          <input className="input" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        <div className="field">
          <label>Ícono</label>
          <div className="row wrap" style={{ gap: 4 }}>
            {Object.keys(ICONS).map((k) => (
              <button key={k} type="button" className="icon-btn sm" style={f.icon === k ? { background: 'var(--p-soft)', color: 'var(--p-600)', boxShadow: '0 0 0 2px var(--p)' } : undefined} onClick={() => setF({ ...f, icon: k })}>
                <Icon name={k} />
              </button>
            ))}
          </div>
        </div>
        {isSuper && (
          <div className="field">
            <label>Empresas que atiende</label>
            <div className="options-grid">
              {companies.map((c) => {
                const on = f.companyIds.includes(c.id);
                return (
                  <label key={c.id} className={`opt-pill ${on ? 'on' : ''}`}>
                    <input type="checkbox" checked={on} onChange={() => setF({ ...f, companyIds: on ? f.companyIds.filter((x) => x !== c.id) : [...f.companyIds, c.id] })} />
                    {c.name}
                  </label>
                );
              })}
            </div>
            <label className="check">
              <input type="checkbox" checked={f.isShared} onChange={(e) => setF({ ...f, isShared: e.target.checked })} /> Área compartida del holding
            </label>
          </div>
        )}
      </div>
    </Modal>
  );
}

function AddMemberModal({ area, canLead, onClose, onSaved }: { area: Area; canLead: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<AreaRole>('MEMBER');
  const { data: people = [] } = useQuery({ queryKey: ['directory', 'search', search], queryFn: async () => (await api.get<DirectoryUser[]>('/users/directory', { params: { search: search || undefined } })).data });
  const add = async (userId: string) => {
    try {
      await api.post(`/areas/${area.id}/members`, { userId, role });
      toast('Persona agregada al área');
      onSaved();
      onClose();
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const existing = new Set(area.members.map((m) => m.user.id));
  return (
    <Modal title={`Agregar a ${area.name}`} subtitle="Pueden ser personas de cualquier empresa del grupo." onClose={onClose} icon={<UserPlus />}>
      <div className="stack">
        <input className="input" placeholder="Buscar por nombre o correo" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
        {canLead && (
          <div className="tabs">
            <button className={role === 'MEMBER' ? 'on' : ''} onClick={() => setRole('MEMBER')}>
              Colaborador
            </button>
            <button className={role === 'LEADER' ? 'on' : ''} onClick={() => setRole('LEADER')}>
              Líder
            </button>
          </div>
        )}
        <div className="stack" style={{ maxHeight: 340, overflow: 'auto', gap: 6 }}>
          {people
            .filter((p) => !existing.has(p.id))
            .map((p) => (
              <button key={p.id} className="select-card" onClick={() => add(p.id)}>
                <Avatar name={p.name} />
                <div style={{ textAlign: 'left' }}>
                  <b>{p.name}</b>
                  <small>
                    {p.jobTitle || p.email} · {p.company?.name}
                  </small>
                </div>
                <Plus size={18} style={{ marginLeft: 'auto', color: 'var(--p)' }} />
              </button>
            ))}
        </div>
      </div>
    </Modal>
  );
}
