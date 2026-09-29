import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Building2,
  FilePen,
  Home,
  Inbox,
  LayoutGrid,
  LogOut,
  Moon,
  Network,
  PieChart,
  Plus,
  Search,
  Settings,
  Sun,
  UserRound,
  Users,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Avatar } from '../components/ui';
import { api } from '../lib/api';
import { fmtDateTime } from '../lib/format';
import type { NotificationItem } from '../lib/types';

const THEME_KEY = 'playtech.theme';
export function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      return (localStorage.getItem(THEME_KEY) as 'light' | 'dark') || 'light';
    } catch {
      return 'light';
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* sin almacenamiento */
    }
    return () => {
      delete document.documentElement.dataset.theme;
    };
  }, [theme]);
  return [theme, setTheme] as const;
}

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get<{ items: NotificationItem[]; unreadCount: number }>('/notifications')).data,
    refetchInterval: 60000,
  });
}

export default function AdminLayout() {
  const { user, isSuper, isCompanyAdmin, isLeader, logout } = useAuth();
  const [theme, setTheme] = useTheme();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: notif } = useNotifications();
  const [open, setOpen] = useState<null | 'bell' | 'user'>(null);
  const [q, setQ] = useState('');
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => popRef.current && !popRef.current.contains(e.target as Node) && setOpen(null);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const slug = user?.company?.slug;
  const items = [
    { to: '/app', icon: LayoutGrid, label: 'Dashboard', end: true, show: true },
    { to: '/app/bandeja', icon: Inbox, label: 'Bandeja de solicitudes', show: true },
    { to: '/app/formularios', icon: FilePen, label: 'Formularios', show: isLeader },
    { to: '/app/reportes', icon: PieChart, label: 'Reportes', show: isLeader || isCompanyAdmin, badge: 'new' },
    { to: '/app/notificaciones', icon: Bell, label: 'Notificaciones', show: true },
    { to: '/app/empresas', icon: Building2, label: isSuper ? 'Empresas e intranets' : 'Mi intranet', show: isSuper || isCompanyAdmin },
    { to: '/app/areas', icon: Network, label: 'Áreas', show: isSuper || isCompanyAdmin || isLeader },
    { to: '/app/usuarios', icon: Users, label: 'Usuarios', show: isSuper || isCompanyAdmin },
    { to: '/app/perfil', icon: UserRound, label: 'Mi perfil', show: true },
  ].filter((i) => i.show);

  const readAll = async () => {
    await api.post('/notifications/read-all');
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  return (
    <div className="admin-shell">
      <div className="side-wave" aria-hidden />
      <nav className="sidebar" aria-label="Menú principal">
        {items.map((i) => (
          <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? 'active' : '')} aria-label={i.label}>
            <i.icon />
            <span className="tip">{i.label}</span>
            {i.to === '/app/notificaciones' && !!notif?.unreadCount && <span className="pill-badge">{notif.unreadCount}</span>}
          </NavLink>
        ))}
      </nav>

      <header className="topnav">
        <Link to="/app" className="brand">
          <span className="logo-mark">P</span>
          Grupo Playtech
        </Link>
        <div className="navlinks">
          <NavLink to="/app" end>
            <LayoutGrid /> Dashboard
          </NavLink>
          <NavLink to="/app/bandeja">
            <Inbox /> Solicitudes
          </NavLink>
          {(isLeader || isCompanyAdmin) && (
            <NavLink to="/app/reportes">
              <PieChart /> Reportes
            </NavLink>
          )}
        </div>
        <form
          className="search"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            nav(`/app/bandeja?q=${encodeURIComponent(q)}`);
          }}
        >
          <Search />
          <input placeholder="Buscar por código, asunto o solicitante" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar solicitudes" />
        </form>
        <div className="right" ref={popRef}>
          <div className="theme-toggle" role="group" aria-label="Tema">
            <button className={theme === 'light' ? 'on' : ''} onClick={() => setTheme('light')}>
              <Sun /> Claro
            </button>
            <button className={theme === 'dark' ? 'on' : ''} onClick={() => setTheme('dark')}>
              <Moon /> Oscuro
            </button>
          </div>
          <div style={{ position: 'relative' }}>
            <button className="icon-btn bell-dot" onClick={() => setOpen(open === 'bell' ? null : 'bell')} aria-label="Notificaciones">
              <Bell />
              {!!notif?.unreadCount && <span className="n">{notif.unreadCount > 99 ? '99+' : notif.unreadCount}</span>}
            </button>
            {open === 'bell' && (
              <div className="menu-pop" style={{ width: 360 }}>
                <div className="row between" style={{ padding: '6px 10px' }}>
                  <b>Notificaciones</b>
                  <button className="xs" style={{ width: 'auto', padding: 4, color: 'var(--p)' }} onClick={readAll}>
                    Marcar todo leído
                  </button>
                </div>
                <div style={{ maxHeight: 380, overflow: 'auto' }}>
                  {(notif?.items || []).slice(0, 8).map((n) => (
                    <Link
                      key={n.id}
                      to={n.requestId ? `/app/solicitudes/${n.requestId}` : '/app/notificaciones'}
                      onClick={() => {
                        setOpen(null);
                        if (!n.read) api.post(`/notifications/${n.id}/read`).then(() => qc.invalidateQueries({ queryKey: ['notifications'] }));
                      }}
                      style={{ alignItems: 'flex-start', opacity: n.read ? 0.65 : 1 }}
                    >
                      <span className="dot" style={{ background: n.read ? 'transparent' : 'var(--p)', marginTop: 6 }} />
                      <span>
                        <b className="small" style={{ display: 'block' }}>{n.title}</b>
                        <span className="xs faint">{n.body.slice(0, 90)}</span>
                        <span className="xs faint" style={{ display: 'block' }}>{fmtDateTime(n.createdAt)}</span>
                      </span>
                    </Link>
                  ))}
                  {!notif?.items.length && <div className="small faint" style={{ padding: 14 }}>No tienes notificaciones.</div>}
                </div>
                <Link to="/app/notificaciones" onClick={() => setOpen(null)} style={{ justifyContent: 'center', color: 'var(--p)' }}>
                  Ver todas
                </Link>
              </div>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button className="user-chip" onClick={() => setOpen(open === 'user' ? null : 'user')}>
              <Avatar name={user?.name} url={user?.avatarUrl} />
              <div style={{ textAlign: 'left' }}>
                <b>{user?.name.split(' ')[0]}</b>
                <small>{user?.company?.name || 'Holding'}</small>
              </div>
            </button>
            {open === 'user' && (
              <div className="menu-pop">
                <div className="hd">{user?.email}</div>
                {slug && (
                  <Link to={`/intranet/${slug}`} onClick={() => setOpen(null)}>
                    <Home /> Ir a la intranet de {user?.company?.name}
                  </Link>
                )}
                <Link to="/app/perfil" onClick={() => setOpen(null)}>
                  <Settings /> Mi perfil
                </Link>
                <button onClick={logout}>
                  <LogOut /> Cerrar sesión
                </button>
              </div>
            )}
          </div>
          <Link className="btn dark" to={slug ? `/intranet/${slug}/solicitudes` : '/app/bandeja'}>
            <Plus /> Nueva solicitud
          </Link>
        </div>
      </header>

      <main className="admin-main">
        <Outlet />
      </main>
    </div>
  );
}
