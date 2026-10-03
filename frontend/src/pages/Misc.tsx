import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, Bell, CheckCheck, Compass, Lock, LogIn, Mail, Save } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useTour } from '../components/Tour';
import { Avatar, Empty, Loading, useToast } from '../components/ui';
import { useNotifications } from '../layouts/AdminLayout';
import { api, errorMessage } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import type { RequestDetail } from '../lib/types';

export function Login() {
  const { login, user } = useAuth();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to={sp.get('next') || '/'} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      nav(sp.get('next') || '/', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const demo = [
    ['Superadministrador', 'admin@grupoplaytech.com'],
    ['Líder de Calidad (compartida)', 'laura.gomez@grupoplaytech.com'],
    ['Colaborador de Calidad', 'andres.rojas@grupoplaytech.com'],
    ['Líder de Tecnología', 'juan.torres@playtech.com.co'],
    ['Empleada TuCompra', 'rachel.lee@tucompra.com.co'],
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: 'minmax(0,1.1fr) minmax(0,1fr)' }} className="login-page">
      <div style={{ background: 'linear-gradient(160deg, #17163a, #6457f5)', color: '#fff', padding: '56px 64px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
        <div className="brand" style={{ color: '#fff' }}>
          <span className="logo-mark" style={{ background: '#fff', color: '#6457f5' }}>P</span> Grupo Playtech
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: 44, lineHeight: 1.1, fontWeight: 700 }}>Una intranet para cada empresa. Un solo lugar para tus solicitudes.</h1>
          <p style={{ marginTop: 18, opacity: 0.8, fontSize: 16, maxWidth: 480 }}>Playtech, TuCompra, Enjambre, Enigma y las áreas compartidas del holding trabajando con trazabilidad, plazos y alertas.</p>
        </div>
        <div className="small" style={{ opacity: 0.7 }}>© {new Date().getFullYear()} Grupo Playtech</div>
        <div style={{ position: 'absolute', right: -120, top: -120, width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,.18), transparent 70%)' }} />
      </div>
      <div style={{ display: 'grid', placeItems: 'center', padding: 24, background: 'var(--bg)' }}>
        <form onSubmit={submit} className="card" style={{ width: 'min(420px, 100%)', padding: 32 }}>
          <h2 style={{ fontSize: 26, fontWeight: 700 }}>Iniciar sesión</h2>
          <p className="muted" style={{ marginTop: 4 }}>Ingresa con tu correo corporativo.</p>
          <div className="stack" style={{ marginTop: 22 }}>
            <div className="field">
              <label htmlFor="em">Correo</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} className="faint" style={{ position: 'absolute', left: 14, top: 14 }} />
                <input id="em" className="input" style={{ paddingLeft: 40 }} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
              </div>
            </div>
            <div className="field">
              <label htmlFor="pw">Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock size={16} className="faint" style={{ position: 'absolute', left: 14, top: 14 }} />
                <input id="pw" className="input" style={{ paddingLeft: 40 }} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>
            {error && <div className="badge tone-red lg" style={{ height: 'auto', padding: '8px 12px', borderRadius: 12 }}>{error}</div>}
            <button className="btn lg block" disabled={busy}>
              <LogIn /> {busy ? 'Ingresando…' : 'Ingresar'}
            </button>
          </div>
          {import.meta.env.DEV && (
            <div style={{ marginTop: 22 }}>
              <div className="xs faint" style={{ marginBottom: 6 }}>Usuarios de demostración · contraseña Playtech2026*</div>
              <div className="stack" style={{ gap: 4 }}>
                {demo.map(([l, e]) => (
                  <button
                    type="button"
                    key={e}
                    className="row between small"
                    style={{ padding: '7px 10px', borderRadius: 10, background: 'var(--card-2)' }}
                    onClick={() => {
                      setEmail(e);
                      setPassword('Playtech2026*');
                    }}
                  >
                    <span>{l}</span>
                    <span className="faint xs">{e}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
      <style>{`@media (max-width: 860px) { .login-page { grid-template-columns: 1fr !important; } .login-page > div:first-child { display: none !important; } }`}</style>
    </div>
  );
}

/** Página de inicio: lleva al usuario a su intranet (o al panel si no tiene empresa) */
export function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={user.company ? `/intranet/${user.company.slug}` : '/app'} replace />;
}

/** Enlace de los correos: abre la solicitud en el panel o en la intranet según el usuario */
export function RequestRedirect() {
  const { id = '' } = useParams();
  const { hasPanel, user } = useAuth();
  const { data, isLoading, error } = useQuery({ queryKey: ['request', id], queryFn: async () => (await api.get<RequestDetail>(`/requests/${id}`)).data, enabled: !hasPanel });
  if (hasPanel) return <Navigate to={`/app/solicitudes/${id}`} replace />;
  if (isLoading) return <Loading />;
  if (error) return <div className="center-screen">{errorMessage(error)}</div>;
  return <Navigate to={`/intranet/${data?.company.slug || user?.company?.slug}/solicitudes/${id}`} replace />;
}

export function NotificationsPage() {
  const { data, isLoading } = useNotifications();
  const qc = useQueryClient();
  const readAll = async () => {
    await api.post('/notifications/read-all');
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };
  if (isLoading) return <Loading />;
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Notificaciones</h1>
          <p className="page-sub">Cada movimiento de tus solicitudes. También te llega por correo.</p>
        </div>
        <button className="btn ghost" onClick={readAll} data-tour="notif-readall">
          <CheckCheck /> Marcar todo como leído
        </button>
      </div>
      <div className="card" data-tour="notif-list">
        {data?.items.length ? (
          <div className="stack" style={{ gap: 0 }}>
            {data.items.map((n) => (
              <Link
                key={n.id}
                to={n.requestId ? `/app/solicitudes/${n.requestId}` : '#'}
                onClick={() => !n.read && api.post(`/notifications/${n.id}/read`).then(() => qc.invalidateQueries({ queryKey: ['notifications'] }))}
                className="row"
                style={{ padding: '14px 8px', borderTop: '1px solid var(--line)', alignItems: 'flex-start', opacity: n.read ? 0.6 : 1 }}
              >
                <span className="ico-box sm">
                  <Bell />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row between">
                    <b className="small">{n.title}</b>
                    <span className="xs faint">{fmtDateTime(n.createdAt)}</span>
                  </div>
                  <div className="small muted">{n.body}</div>
                </div>
                {!n.read && <span className="dot" style={{ background: 'var(--p)', marginTop: 8 }} />}
                <ArrowRight size={16} className="faint" style={{ marginTop: 4 }} />
              </Link>
            ))}
          </div>
        ) : (
          <Empty title="No tienes notificaciones" icon={<Bell />} />
        )}
      </div>
    </>
  );
}

export function Profile() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const tour = useTour();
  const [f, setF] = useState({ name: user?.name || '', jobTitle: user?.jobTitle || '', phone: user?.phone || '', currentPassword: '', newPassword: '' });
  const [busy, setBusy] = useState(false);
  const restartTours = async () => {
    try {
      await tour.reset();
      toast('Listo: verás de nuevo el recorrido al entrar a cada sección');
      tour.start(['panel', 'profile']);
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const save = async () => {
    setBusy(true);
    try {
      await api.patch('/users/me', { ...f, currentPassword: f.currentPassword || undefined, newPassword: f.newPassword || undefined });
      await refresh();
      setF({ ...f, currentPassword: '', newPassword: '' });
      toast('Perfil actualizado');
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <div className="page-head">
        <div className="row">
          <Avatar name={user?.name} size="lg" />
          <div>
            <h1 className="page-title">{user?.name}</h1>
            <p className="page-sub">
              {user?.email} · {user?.company?.name || 'Holding'}
            </p>
          </div>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1.3fr 1fr' }}>
        <div className="card">
          <div className="card-h">
            <h3>Datos personales</h3>
          </div>
          <div className="form-grid" data-tour="profile-data">
            <div className="field">
              <label>Nombre</label>
              <input className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </div>
            <div className="field">
              <label>Cargo</label>
              <input className="input" value={f.jobTitle} onChange={(e) => setF({ ...f, jobTitle: e.target.value })} />
            </div>
            <div className="field">
              <label>Teléfono</label>
              <input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </div>
          </div>
          <div className="divider" />
          <div className="card-h">
            <h3>Cambiar contraseña</h3>
          </div>
          <div className="form-grid" data-tour="profile-password">
            <div className="field">
              <label>Contraseña actual</label>
              <input className="input" type="password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} />
            </div>
            <div className="field">
              <label>Nueva contraseña</label>
              <input className="input" type="password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} />
            </div>
          </div>
          <div className="row mt" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={save} disabled={busy} data-tour="profile-save">
              <Save /> Guardar
            </button>
          </div>
        </div>
        <div className="stack" style={{ gap: 20 }}>
          <div className="card" data-tour="profile-areas">
            <div className="card-h">
              <h3>Mis áreas</h3>
            </div>
            <div className="stack">
              {user?.memberships.map((m) => (
                <div key={m.id} className="row between" style={{ padding: 10, borderRadius: 12, background: 'var(--card-2)' }}>
                  <span className="bold small">{m.area.name}</span>
                  <span className={`badge ${m.role === 'LEADER' ? 'tone-amber' : 'tone-blue'}`}>{m.role === 'LEADER' ? 'Líder' : 'Colaborador'}</span>
                </div>
              ))}
              {!user?.memberships.length && <div className="small faint">No perteneces a ninguna área.</div>}
            </div>
          </div>
          <div className="card" data-tour="profile-tours">
            <div className="card-h">
              <h3>Recorridos guiados</h3>
            </div>
            <p className="small muted">Las secciones del panel muestran un recorrido la primera vez que entras. Reinícialos para volver a verlos todos.</p>
            <button className="btn outline mt" onClick={restartTours}>
              <Compass /> Reiniciar recorridos
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
