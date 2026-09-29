import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronLeft, ChevronRight, ClipboardList, Clock, Eye, File, Flag, Folder, Megaphone, Send, ShieldCheck, Target, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { SlaBadge, StatusBadge } from '../../components/ui';
import { useCompany } from '../../layouts/IntranetLayout';
import { api, fileUrl } from '../../lib/api';
import { DOC_CATEGORIES } from '../../lib/format';
import { Icon } from '../../lib/icons';
import type { Paged, RequestItem } from '../../lib/types';

export function useMyRequests(pageSize = 50) {
  return useQuery({
    queryKey: ['requests', 'mine', pageSize],
    queryFn: async () => (await api.get<Paged<RequestItem>>('/requests', { params: { scope: 'mine', pageSize } })).data,
  });
}

export default function IntranetHome() {
  const company = useCompany();
  const { user } = useAuth();
  const base = `/intranet/${company.slug}`;
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const h = now.getHours();
  const greet = h < 12 ? '¡Buenos días' : h < 19 ? '¡Buenas tardes' : '¡Buenas noches';
  const date = now.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  // anuncios
  const news = company.announcements.length ? company.announcements : [`Bienvenido(a) a la intranet de ${company.name}.`];
  const [ni, setNi] = useState(0);
  useEffect(() => {
    const t = setInterval(() => !document.hidden && setNi((x) => (x + 1) % news.length), 7000);
    return () => clearInterval(t);
  }, [news.length]);

  // carrusel estrategia
  const slides = [
    { t: 'Misión', img: company.missionImageUrl, p: company.missionText, icon: Flag },
    { t: 'Visión', img: company.visionImageUrl, p: company.visionText, icon: Eye },
    { t: 'Objetivos estratégicos', img: company.heroImageUrl, p: company.objectivesText, icon: Target },
  ].filter((s) => s.p);
  const [si, setSi] = useState(0);
  const slide = slides[si % Math.max(1, slides.length)];

  const tiles = [
    { to: 'solicitudes', label: 'Solicitudes', icon: ClipboardList },
    { to: 'mis-solicitudes', label: 'Mis solicitudes', icon: UserRound },
    { to: 'estrategia', label: 'Despliegue estratégico', icon: Flag },
    { to: 'contexto', label: 'Contexto organizacional', icon: Building2 },
    { to: 'documentacion', label: 'Documentación', icon: Folder },
    { to: 'sistema-gestion', label: 'Sistema de gestión', icon: ShieldCheck },
    { to: 'solicitudes', label: 'Áreas que te atienden', icon: Send },
    { to: 'mis-solicitudes', label: 'Seguimiento', icon: Clock },
  ];
  const keyDocs = company.documents.filter((d) => d.featured).slice(0, 4);
  const { data: mine } = useMyRequests();
  const open = (mine?.items || []).filter((r) => !['RESOLVED', 'CANCELLED'].includes(r.status));

  return (
    <>
      <div className="hero-row">
        <div
          className={`icard welcome ${company.heroImageUrl ? 'has-img' : ''}`}
          style={company.heroImageUrl ? { backgroundImage: `linear-gradient(135deg, color-mix(in srgb, var(--navy-800) 92%, transparent), color-mix(in srgb, var(--brand) 70%, transparent)), url(${fileUrl(company.heroImageUrl)})` } : undefined}
        >
          <div className="mega">
            <Megaphone />
          </div>
          <div>
            <h1>
              {greet}, {user?.name.split(' ')[0]}!
            </h1>
            <div className="date">{date.charAt(0).toUpperCase() + date.slice(1)}</div>
            <div className="time">
              <Clock /> {now.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
        <div className="icard tiles">
          {tiles.map((t, i) => (
            <Link key={t.label} className={`tile ${i === 0 ? 'featured' : ''}`} to={`${base}/${t.to}`}>
              <span className="i-ico">
                <t.icon />
              </span>
              {t.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="icard ticker" aria-live="polite">
        <div className="lbl">
          <Megaphone /> <span>Anuncios</span>
        </div>
        <div className="msg" title={news[ni]}>
          {news[ni]}
        </div>
        <div className="ctrl">
          <button className="round" onClick={() => setNi((ni - 1 + news.length) % news.length)} aria-label="Anuncio anterior">
            <ChevronLeft />
          </button>
          <button className="round dark" onClick={() => setNi((ni + 1) % news.length)} aria-label="Anuncio siguiente">
            <ChevronRight />
          </button>
        </div>
      </div>

      <div className="igrid three" style={{ marginTop: 20 }}>
        <div>
          <div className="h-sec">
            Documentos clave <Link to={`${base}/documentacion`}><small>Ver todo</small></Link>
          </div>
          {keyDocs.map((d) => (
            <a key={d.id} className="doc-item" href={d.url} target="_blank" rel="noreferrer">
              <span className="i-ico">
                <File />
              </span>
              <span>
                <b>{d.title}</b>
                <small>
                  {DOC_CATEGORIES[d.category] || d.category}
                  {d.process ? ` · ${d.process}` : ''}
                </small>
              </span>
            </a>
          ))}
          {!keyDocs.length && <div className="icard small" style={{ color: 'var(--i-ink-3)' }}>Aún no hay documentos destacados.</div>}
        </div>
        <div>
          <div className="h-sec">
            Nuestra estrategia <Link to={`${base}/estrategia`}><small>Ver más</small></Link>
          </div>
          <div className="icard slide">
            {slide?.img ? (
              <img className="slide-img" src={fileUrl(slide.img)} alt={slide.t} />
            ) : (
              <div className="slide-ph">{slide ? <slide.icon /> : <Target />}</div>
            )}
            <h3>{slide?.t || 'Estrategia'}</h3>
            <p>{slide?.p || 'La empresa aún no ha publicado su misión y visión.'}</p>
            <div className="slide-foot">
              <div className="dots">
                {slides.map((s, j) => (
                  <i key={s.t} className={j === si % slides.length ? 'on' : ''} />
                ))}
              </div>
              <div className="ctrl" style={{ display: 'flex', gap: 6 }}>
                <button className="round" onClick={() => setSi((si - 1 + slides.length) % Math.max(1, slides.length))} aria-label="Anterior">
                  <ChevronLeft />
                </button>
                <button className="round" onClick={() => setSi((si + 1) % Math.max(1, slides.length))} aria-label="Siguiente">
                  <ChevronRight />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div>
          <div className="h-sec">Propósito de la intranet</div>
          <div className="icard obj-card">
            <div className="obj-head">
              <div className="avatar-i">
                <Target />
              </div>
              <div>
                <b>Objetivo</b>
                <small>Intranet {company.legalName || company.name}</small>
              </div>
            </div>
            <h4>¿Para qué existe este espacio?</h4>
            <p>{company.purposeText || 'Centralizar la información, facilitar la colaboración y optimizar los procesos internos.'}</p>
            <Link className="ibtn" to={`${base}/solicitudes`}>
              <Send /> Crear una solicitud
            </Link>
          </div>
        </div>
      </div>

      <div className="icard" style={{ marginTop: 32 }}>
        <div className="h-sec">
          Áreas que te atienden <Link to={`${base}/solicitudes`}><small>Ver catálogo de solicitudes</small></Link>
        </div>
        <div className="quick">
          {company.areas.map((a) => (
            <Link key={a.id} className="ql" to={`${base}/solicitudes#${a.id}`}>
              <span className="circle">
                <Icon name={a.icon} />
                {a.isShared && <span className="shared">Holding</span>}
              </span>
              {a.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="igrid two" style={{ marginTop: 32 }}>
        <div className="icard">
          <div className="h-sec">
            Mis solicitudes abiertas <Link to={`${base}/mis-solicitudes`}><small>Ver todas</small></Link>
          </div>
          {open.slice(0, 5).map((r) => (
            <Link key={r.id} className="my-req" to={`${base}/solicitudes/${r.id}`}>
              <span className="i-ico">
                <Icon name={r.form.icon} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b>{r.subject}</b>
                <small>
                  {r.code} · {r.area.name}
                </small>
              </span>
              <span className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                <StatusBadge status={r.status} />
                <SlaBadge r={r} />
              </span>
            </Link>
          ))}
          {!open.length && (
            <div className="note soft">
              <ClipboardList />
              <div>No tienes solicitudes abiertas. Cuando radiques una, verás aquí su avance y fecha límite.</div>
            </div>
          )}
        </div>
        <MiniCalendar dates={open.map((r) => r.dueAt)} />
      </div>
    </>
  );
}

function MiniCalendar({ dates }: { dates: string[] }) {
  const [ref, setRef] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });
  const now = new Date();
  const marks = useMemo(() => new Set(dates.map((d) => new Date(d).toDateString())), [dates]);
  const y = ref.getFullYear(),
    m = ref.getMonth();
  const first = (new Date(y, m, 1).getDay() + 6) % 7;
  const days = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  const cells: { txt: number; cls: string }[] = [];
  for (let i = 0; i < 42; i++) {
    const dn = i - first + 1;
    if (i >= 35 && dn > days) break;
    if (dn < 1) cells.push({ txt: prevDays + dn, cls: 'd out' });
    else if (dn > days) cells.push({ txt: dn - days, cls: 'd out' });
    else {
      const date = new Date(y, m, dn);
      let cls = 'd';
      if (i % 7 > 4) cls += ' we';
      if (date.toDateString() === now.toDateString()) cls += ' today';
      if (marks.has(date.toDateString())) cls += ' has';
      cells.push({ txt: dn, cls });
    }
  }
  return (
    <div className="icard">
      <div className="h-sec" style={{ marginBottom: 0 }}>
        Calendario
      </div>
      <div className="cal-head">
        <button className="round" onClick={() => setRef(new Date(y, m - 1, 1))} aria-label="Mes anterior">
          <ChevronLeft />
        </button>
        <b>{ref.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' })}</b>
        <button className="round" onClick={() => setRef(new Date(y, m + 1, 1))} aria-label="Mes siguiente">
          <ChevronRight />
        </button>
      </div>
      <div className="cal">
        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
          <div key={d} className="dow">
            {d}
          </div>
        ))}
        {cells.map((c, i) => (
          <div key={i} className={c.cls}>
            {c.txt}
          </div>
        ))}
      </div>
      <div className="cal-foot">
        <span className="i-ico" style={{ width: 36, height: 36 }}>
          <Clock size={18} />
        </span>
        <span>
          Los puntos marcan la <b>fecha límite</b> de tus solicitudes abiertas. Los plazos se cuentan en días hábiles.
        </span>
      </div>
    </div>
  );
}
