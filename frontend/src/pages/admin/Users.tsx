import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Crown, Pencil, Plus, Search, Users as UsersIcon } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Avatar, Empty, Loading, Modal, Switch, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import type { CompanyBrief, GlobalRole, Me } from '../../lib/types';

const ROLE_LABEL: Record<GlobalRole, string> = { SUPER_ADMIN: 'Superadministrador', COMPANY_ADMIN: 'Admin. de intranet', USER: 'Colaborador' };

type UserRow = Me & { active: boolean };

export default function Users() {
  const { isSuper } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [companyId, setCompanyId] = useState('');
  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<UserRow | 'new' | null>(null);
  const { data: companies = [] } = useQuery({ queryKey: ['companies'], queryFn: async () => (await api.get<CompanyBrief[]>('/companies')).data });
  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users', companyId, search],
    queryFn: async () => (await api.get<UserRow[]>('/users', { params: { companyId: companyId || undefined, search: search || undefined } })).data,
  });

  const toggleActive = async (u: UserRow) => {
    try {
      await api.patch(`/users/${u.id}`, { active: !u.active });
      qc.invalidateQueries({ queryKey: ['users'] });
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Usuarios</h1>
          <p className="page-sub">Colaboradores de {isSuper ? 'todas las empresas del grupo' : 'tu empresa'}, su rol y sus áreas.</p>
        </div>
        <div className="row">
          <div style={{ position: 'relative' }} data-tour="users-search">
            <Search size={16} className="faint" style={{ position: 'absolute', left: 12, top: 10 }} />
            <input className="input sm" style={{ paddingLeft: 36, width: 220 }} placeholder="Buscar" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {isSuper && (
            <select className="select sm" value={companyId} onChange={(e) => setCompanyId(e.target.value)} data-tour="users-company">
              <option value="">Todas las empresas</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <button className="btn dark" onClick={() => setEdit('new')} data-tour="users-new">
            <Plus /> Nuevo usuario
          </button>
        </div>
      </div>
      <div className="card">
        {isLoading ? (
          <Loading />
        ) : users.length ? (
          <div className="table-wrap" data-tour="users-table">
            <table className="table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Empresa</th>
                  <th>Rol</th>
                  <th>Áreas</th>
                  <th>Activo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u, ui) => (
                  <tr key={u.id} style={{ opacity: u.active ? 1 : 0.55 }}>
                    <td>
                      <div className="row">
                        <Avatar name={u.name} />
                        <div>
                          <div className="bold">{u.name}</div>
                          <div className="xs faint">
                            {u.email} · {u.jobTitle}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>{u.company?.name || '—'}</td>
                    <td>
                      <span className={`badge ${u.role === 'USER' ? 'tone-gray' : 'tone-violet'}`}>{ROLE_LABEL[u.role]}</span>
                    </td>
                    <td>
                      <div className="row wrap" style={{ gap: 4 }}>
                        {u.memberships.map((m) => (
                          <span key={m.id} className={`badge ${m.role === 'LEADER' ? 'tone-amber' : 'tone-blue'}`}>
                            {m.role === 'LEADER' && <Crown />} {m.area.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td data-tour={ui === 0 ? 'users-active' : undefined}>
                      <Switch on={u.active} onChange={() => toggleActive(u)} />
                    </td>
                    <td>
                      <button className="icon-btn sm" onClick={() => setEdit(u)} aria-label="Editar" data-tour={ui === 0 ? 'users-edit' : undefined}>
                        <Pencil />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Sin usuarios" icon={<UsersIcon />} />
        )}
      </div>
      {edit && <UserModal user={edit === 'new' ? null : edit} companies={companies} onClose={() => setEdit(null)} onSaved={() => qc.invalidateQueries({ queryKey: ['users'] })} />}
    </>
  );
}

function UserModal({ user, companies, onClose, onSaved }: { user: UserRow | null; companies: CompanyBrief[]; onClose: () => void; onSaved: () => void }) {
  const { isSuper, user: me } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({
    name: user?.name || '',
    email: user?.email || '',
    jobTitle: user?.jobTitle || '',
    phone: user?.phone || '',
    companyId: user?.companyId || me?.companyId || '',
    role: (user?.role || 'USER') as GlobalRole,
    password: '',
  });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      if (user) {
        const { email: _e, ...rest } = f;
        await api.patch(`/users/${user.id}`, { ...rest, password: f.password || undefined, companyId: isSuper ? f.companyId : undefined });
      } else await api.post('/users', { ...f, companyId: isSuper ? f.companyId : undefined });
      toast(user ? 'Usuario actualizado' : 'Usuario creado');
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
      title={user ? 'Editar usuario' : 'Nuevo usuario'}
      subtitle="Las áreas y el liderazgo se asignan desde la sección Áreas."
      onClose={onClose}
      footer={
        <>
          <button className="btn outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn" disabled={busy || f.name.length < 2 || (!user && f.password.length < 8)} onClick={save}>
            Guardar
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field">
          <label>Nombre</label>
          <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </div>
        <div className="field">
          <label>Correo</label>
          <input className="input" type="email" value={f.email} disabled={!!user} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <div className="field">
          <label>Cargo</label>
          <input className="input" value={f.jobTitle} onChange={(e) => setF({ ...f, jobTitle: e.target.value })} />
        </div>
        <div className="field">
          <label>Teléfono</label>
          <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </div>
        {isSuper && (
          <div className="field">
            <label>Empresa</label>
            <select className="select" value={f.companyId} onChange={(e) => setF({ ...f, companyId: e.target.value })}>
              <option value="">Sin empresa (holding)</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="field">
          <label>Rol</label>
          <select className="select" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as GlobalRole })}>
            <option value="USER">Colaborador</option>
            <option value="COMPANY_ADMIN">Administrador de intranet</option>
            {isSuper && <option value="SUPER_ADMIN">Superadministrador</option>}
          </select>
        </div>
        <div className="field full">
          <label>{user ? 'Nueva contraseña (opcional)' : 'Contraseña inicial'}</label>
          <input className="input" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} placeholder="Mínimo 8 caracteres" />
        </div>
      </div>
    </Modal>
  );
}
