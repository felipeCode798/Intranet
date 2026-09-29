import { useQuery } from '@tanstack/react-query';
import { Building2, Calendar, ChevronRight, ClipboardList, FileText, Flag, Folder, Home, LayoutGrid, LogOut, Search, ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Loading } from '../components/ui';
import { api, errorMessage, fileUrl } from '../lib/api';
import { Icon } from '../lib/icons';
import { companyPalette } from '../lib/theme';
import type { IntranetCompany } from '../lib/types';

export const useCompany = () => useOutletContext<{ company: IntranetCompany }>().company;

const SECTIONS = [
  { to: '', label: 'Inicio', icon: Home, end: true },
  { to: 'solicitudes', label: 'Solicitudes', icon: ClipboardList },
  { to: 'mis-solicitudes', label: 'Mis solicitudes', icon: UserRound },
  { to: 'estrategia', label: 'Despliegue estratégico', icon: Flag },
  { to: 'contexto', label: 'Contexto organizacional', icon: Building2 },
  { to: 'documentacion', label: 'Documentación', icon: Folder },
  { to: 'sistema-gestion', label: 'Sistema de gestión', icon: ShieldCheck },
];

export default function IntranetLayout() {
  const { slug = '' } = useParams();
  const { user, isSuper, hasPanel, logout } = useAuth();
  const loc = useLocation();
  const nav = useNavigate();
  const { data: company, isLoading, error } = useQuery({
    queryKey: ['intranet', slug],
    queryFn: async () => (await api.get<IntranetCompany>(`/companies/by-slug/${slug}`)).data,
  });
  const [q, setQ] = useState('');
  const [showRes, setShowRes] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => searchRef.current && !searchRef.current.contains(e.target as Node) && setShowRes(false);
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  useEffect(() => {
    if (company) document.title = `Intranet · ${company.name}`;
    window.scrollTo(0, 0);
  }, [company, loc.pathname]);

  const index = useMemo(() => {
    if (!company) return [];
    const base = `/intranet/${slug}`;
    return [
      ...SECTIONS.map((s) => ({ t: s.label, s: 'Sección', h: `${base}/${s.to}`, icon: 'layers' })),
      ...company.areas.flatMap((a) => a.forms.map((f) => ({ t: f.name, s: `Solicitud · ${a.name}`, h: `${base}/solicitudes/nueva/${f.id}`, icon: f.icon }))),
      ...company.documents.map((d) => ({ t: d.title, s: `Documento · ${d.process || d.category}`, h: d.url, ext: true, icon: 'file-text' })),
    ] as { t: string; s: string; h: string; ext?: boolean; icon: string }[];
  }, [company, slug]);

  if (!isSuper && user?.company && user.company.slug !== slug) return <Navigate to={`/intranet/${user.company.slug}`} replace />;
  if (isLoading) return <Loading />;
  if (error || !company) return <div className="center-screen">{errorMessage(error)}</div>;

  const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const hits = q.trim() ? index.filter((x) => norm(`${x.t} ${x.s}`).includes(norm(q))).slice(0, 10) : [];
  const current = SECTIONS.find((s) => (s.to ? loc.pathname.startsWith(`/intranet/${slug}/${s.to}`) : loc.pathname.replace(/\/$/, '') === `/intranet/${slug}`));
  const today = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="intranet" style={companyPalette(company.primaryColor, company.secondaryColor)}>
      <header className="i-topbar">
        <div className="wrap">
          <Link className="i-logo" to={`/intranet/${slug}`} aria-label="Ir al inicio">
            {company.logoUrl ? <img src={fileUrl(company.logoUrl)} alt={company.name} /> : <span className="word">{company.name.toUpperCase()}</span>}
            <span className="tag">Intranet</span>
          </Link>
          <div className="i-search" role="search" ref={searchRef}>
            <Search />
            <input
              type="search"
              placeholder="Buscar secciones, solicitudes o documentos…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setShowRes(true);
              }}
              onFocus={() => setShowRes(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && hits[0]) {
                  hits[0].ext ? window.open(hits[0].h, '_blank') : nav(hits[0].h);
                  setShowRes(false);
                  setQ('');
                }
              }}
              aria-label="Buscar en la intranet"
            />
            {showRes && q.trim() && (
              <div className="i-results">
                {hits.map((x) =>
                  x.ext ? (
                    <a key={x.h + x.t} href={x.h} target="_blank" rel="noreferrer" onClick={() => setShowRes(false)}>
                      <span className="i-ico" style={{ width: 34, height: 34 }}>
                        <FileText size={16} />
                      </span>
                      <span>
                        {x.t}
                        <small>{x.s}</small>
                      </span>
                    </a>
                  ) : (
                    <Link
                      key={x.h + x.t}
                      to={x.h}
                      onClick={() => {
                        setShowRes(false);
                        setQ('');
                      }}
                    >
                      <span className="i-ico" style={{ width: 34, height: 34 }}>
                        <Icon name={x.icon} size={16} />
                      </span>
                      <span>
                        {x.t}
                        <small>{x.s}</small>
                      </span>
                    </Link>
                  ),
                )}
                {!hits.length && <div className="empty-r">Sin resultados para “{q}”</div>}
              </div>
            )}
          </div>
          <div className="i-top-right">
            <span className="pill date">
              <Calendar /> <span>{today}</span>
            </span>
            {hasPanel && (
              <Link className="pill" to="/app">
                <LayoutGrid /> <span>Panel de gestión</span>
              </Link>
            )}
            <button className="pill" onClick={logout} title={`Cerrar sesión de ${user?.name}`}>
              <LogOut /> <span>Salir</span>
            </button>
          </div>
        </div>
      </header>

      <nav className="i-nav" aria-label="Secciones">
        <div className="wrap">
          {SECTIONS.map((s) => (
            <NavLink key={s.to} to={s.to ? `/intranet/${slug}/${s.to}` : `/intranet/${slug}`} end={s.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {s.to === '' && <s.icon />}
              {s.label}
            </NavLink>
          ))}
        </div>
      </nav>

      <main>
        <div className="wrap">
          <div className="i-subbar">
            <div className="i-crumbs">
              <Home /> Intranet <ChevronRight /> <b>{current?.label || 'Solicitud'}</b>
            </div>
            <div className="upd">{company.managementSystem ? `Sistema de Gestión · ${company.managementSystem}` : company.slogan}</div>
          </div>
          <div className="i-page" key={loc.pathname}>
            <Outlet context={{ company }} />
          </div>
        </div>
      </main>

      <footer className="i-footer">
        <div className="wrap">
          <span>
            <b>{company.legalName || company.name}</b> · Intranet corporativa · Grupo Playtech
          </span>
          <span>
            {company.managementSystem ? `${company.managementSystem} · ` : ''}© {new Date().getFullYear()}
          </span>
        </div>
      </footer>
    </div>
  );
}
