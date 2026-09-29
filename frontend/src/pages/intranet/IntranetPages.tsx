import { BarChart3, BookOpen, Building2, CheckCircle2, ClipboardCheck, Eye, File, Fish, Flag, Folder, Globe, Grid3x3, Info, Layers, Network, RefreshCw, ShieldCheck, Star, Target, TrendingUp, Users, Wrench, X, ZoomIn } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCompany } from '../../layouts/IntranetLayout';
import { fileUrl } from '../../lib/api';
import { DOC_CATEGORIES } from '../../lib/format';
import { Icon } from '../../lib/icons';

function Zoomable({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <img className="zoomable" src={src} alt={alt} onClick={() => setOpen(true)} />
      {open && (
        <div className="lb" role="dialog" aria-label="Imagen ampliada" onClick={() => setOpen(false)}>
          <button aria-label="Cerrar">
            <X />
          </button>
          <img src={src} alt={alt} />
        </div>
      )}
    </>
  );
}

export function Strategy() {
  const c = useCompany();
  return (
    <>
      <div className="phero">
        <div className="ph-icon">
          <Flag />
        </div>
        <h1>
          Despliegue <br />
          <em>estratégico</em>
        </h1>
        <p>Misión, visión y objetivos que orientan el rumbo de {c.legalName || c.name}.</p>
        <div className="chips">
          <span className="chip"><Target />Alineación</span>
          <span className="chip"><Layers />Estrategia</span>
          <span className="chip"><BarChart3 />Indicadores</span>
          <span className="chip"><CheckCircle2 />Resultados</span>
        </div>
      </div>
      <div className="mv" style={{ marginTop: 20 }}>
        {[
          { t: 'Misión', icon: Flag, img: c.missionImageUrl, text: c.missionText },
          { t: 'Visión', icon: Eye, img: c.visionImageUrl, text: c.visionText },
        ].map((b) => (
          <div className="icard" key={b.t}>
            {b.img ? (
              <img src={fileUrl(b.img)} alt={b.t} />
            ) : (
              <div className="slide-ph">
                <b.icon />
              </div>
            )}
            <div className="body">
              <h2>
                <span className="i-ico">
                  <b.icon />
                </span>
                {b.t}
              </h2>
              <p>{b.text || 'Pendiente por definir.'}</p>
            </div>
          </div>
        ))}
      </div>
      {c.objectivesText && (
        <div className="icard goal" style={{ marginTop: 20 }}>
          <div className="i-ico">
            <Target />
          </div>
          <div>
            <span className="eyebrow">Objetivos estratégicos</span>
            <p>{c.objectivesText}</p>
          </div>
        </div>
      )}
      {c.values.length > 0 && (
        <>
          <div className="h-sec" style={{ marginTop: 32 }}>Nuestros valores</div>
          <div className="values">
            {c.values.map((v) => (
              <div className="icard value" key={v}>
                <span className="i-ico">
                  <Star />
                </span>
                <b>{v}</b>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

export function Context() {
  const c = useCompany();
  const shared = c.areas.filter((a) => a.isShared);
  const own = c.areas.filter((a) => !a.isShared);
  return (
    <>
      <div className="phero">
        <div className="ph-icon">
          <Building2 />
        </div>
        <h1>
          Contexto <br />
          <em>organizacional</em>
        </h1>
        <p>Estructura organizacional y áreas que atienden a {c.name}, incluidas las áreas compartidas del Grupo Playtech.</p>
        <div className="chips">
          <span className="chip"><Users />Partes interesadas</span>
          <span className="chip"><Network />Estructura</span>
          <span className="chip"><Globe />Áreas del holding</span>
        </div>
      </div>
      <div className="icard" style={{ marginTop: 20 }}>
        <div className="h-sec" style={{ marginBottom: 0 }}>
          Mapa de áreas <small>Haz clic en un área para ver sus solicitudes</small>
        </div>
        {[
          ['Áreas del holding (compartidas)', shared],
          [`Áreas de ${c.name}`, own],
        ].map(([title, list]) =>
          (list as typeof c.areas).length ? (
            <div key={title as string} style={{ marginTop: 18, borderRadius: 16, padding: 16, background: 'var(--soft)' }}>
              <div className="eyebrow" style={{ marginBottom: 10 }}>{title as string}</div>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
                {(list as typeof c.areas).map((a) => (
                  <Link key={a.id} to={`/intranet/${c.slug}/solicitudes#${a.id}`} className="doc-item" style={{ marginTop: 0 }}>
                    <span className="i-ico" style={{ width: 36, height: 36 }}>
                      <Icon name={a.icon} size={17} />
                    </span>
                    <span>
                      <b>{a.name}</b>
                      <small>{a.leaders.map((l) => l.name).join(', ') || 'Sin líder asignado'}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null,
        )}
      </div>
      <div className="icard" style={{ marginTop: 20 }}>
        <div className="h-sec">Organigrama</div>
        {c.organigramUrl ? (
          <>
            <Zoomable src={fileUrl(c.organigramUrl)} alt={`Organigrama ${c.name}`} />
            <p className="sec-sub" style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <ZoomIn size={15} /> Haz clic en la imagen para ampliarla.
            </p>
          </>
        ) : (
          <div className="note soft">
            <Info />
            <div>El administrador de la intranet aún no ha cargado el organigrama.</div>
          </div>
        )}
      </div>
    </>
  );
}

export function Documents() {
  const c = useCompany();
  const processes = useMemo(() => {
    const m = new Map<string, number>();
    c.documents.forEach((d) => m.set(d.process || 'General', (m.get(d.process || 'General') || 0) + 1));
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [c.documents]);
  const [proc, setProc] = useState<string>('');
  const current = proc || processes[0]?.[0] || '';
  const docs = c.documents.filter((d) => (d.process || 'General') === current);
  return (
    <>
      <div className="phero">
        <div className="ph-icon">
          <Folder />
        </div>
        <h1>
          <em>Documentación</em>
        </h1>
        <p>Formatos, procedimientos, políticas, registros, manuales e instructivos del Sistema de Gestión.</p>
        <div className="chips">
          <span className="chip"><File />Controlada</span>
          <span className="chip"><ShieldCheck />Actualizada</span>
          <span className="chip"><Folder />Organizada</span>
        </div>
      </div>
      {processes.length ? (
        <div className="docs-layout" style={{ marginTop: 20 }}>
          <aside className="icard proc-list" aria-label="Procesos">
            <div className="grp">Procesos</div>
            {processes.map(([p, n]) => (
              <button key={p} className={p === current ? 'on' : ''} onClick={() => setProc(p)}>
                <span className="i-ico">
                  <Layers />
                </span>
                <span>{p}</span>
                <span className="count">{n}</span>
              </button>
            ))}
          </aside>
          <div className="icard">
            <div className="proc-head">
              <span className="i-ico">
                <Layers />
              </span>
              <div>
                <span className="eyebrow">Proceso</span>
                <div className="sec-title">{current}</div>
                <div className="sec-sub">{docs.length} documento(s) publicado(s)</div>
              </div>
            </div>
            <div className="cats">
              {Object.entries(DOC_CATEGORIES).map(([k, label]) => {
                const list = docs.filter((d) => d.category === k);
                return (
                  <div className="cat" key={k}>
                    <div className="cat-h">
                      <span className="i-ico">
                        <BookOpen />
                      </span>
                      {label}
                      <span className="count">{list.length}</span>
                    </div>
                    {list.length ? (
                      <ul>
                        {list.map((d) => (
                          <li key={d.id}>
                            <a href={d.url} target="_blank" rel="noreferrer">
                              <File />
                              <span>{d.title}</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="none">Sin documentos publicados</div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="note soft">
              <Info />
              <div>
                ¿Necesitas crear o actualizar un documento? <Link className="bold" style={{ color: 'var(--brand)' }} to={`/intranet/${c.slug}/solicitudes`}>Radica una solicitud a Calidad</Link>.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="icard" style={{ marginTop: 20 }}>Aún no hay documentos publicados.</div>
      )}
    </>
  );
}

const CLAUSES = ['Objeto y campo de aplicación', 'Referencias normativas', 'Términos y definiciones', 'Contexto de la organización', 'Liderazgo', 'Planificación', 'Apoyo', 'Operación', 'Evaluación del desempeño', 'Mejora'];
const TOOLS = [
  { t: 'Análisis DOFA', tag: 'Estrategia', icon: Grid3x3, p: 'Evalúa los factores internos y externos que influyen en el éxito de la organización: Fortalezas, Oportunidades, Debilidades y Amenazas, para maximizar puntos fuertes y mitigar riesgos.' },
  { t: 'Análisis PESTEL', tag: 'Entorno', icon: Globe, p: 'Examina los factores Políticos, Económicos, Sociales, Tecnológicos, Ecológicos y Legales que impactan el entorno en el que opera la organización.' },
  { t: 'Análisis FMEA', tag: 'Riesgos', icon: ShieldCheck, p: 'Identifica y prioriza modos de falla según gravedad, probabilidad de ocurrencia y detección (RPN = O × D × G) para definir acciones preventivas.' },
  { t: 'Metodología 5S', tag: 'Orden', icon: ClipboardCheck, p: 'Seiri (clasificar), Seiton (ordenar), Seiso (limpiar), Seiketsu (estandarizar) y Shitsuke (sostener) para entornos de trabajo eficientes.' },
  { t: 'Espina de pescado', tag: 'Causa raíz', icon: Fish, p: 'El diagrama de Ishikawa desglosa las causas de un problema en categorías para encontrar su causa fundamental.' },
];

export function Quality() {
  const c = useCompany();
  return (
    <>
      <div className="phero">
        <div className="ph-icon">
          <ShieldCheck />
        </div>
        <h1>
          Sistema de <br />
          <em>{c.managementSystem || 'gestión'}</em>
        </h1>
        <p>Estructura de la norma, requisitos del sistema y herramientas de mejora compartidas por el área de Calidad del Grupo Playtech.</p>
        <div className="chips">
          <span className="chip"><Globe />4. Contexto</span>
          <span className="chip"><Users />5. Liderazgo</span>
          <span className="chip"><Target />6. Planificación</span>
          <span className="chip"><Wrench />7. Apoyo</span>
          <span className="chip"><Layers />8. Operación</span>
          <span className="chip"><BarChart3 />9. Evaluación</span>
          <span className="chip"><TrendingUp />10. Mejora</span>
        </div>
      </div>
      <div className="icard" style={{ marginTop: 20 }}>
        <span className="eyebrow">Norma</span>
        <div className="sec-title">Estructura de la norma ISO 9001:2015</div>
        <div className="clauses">
          {CLAUSES.map((cl, i) => (
            <div className="clause" key={cl}>
              <div className="num">{i + 1}</div>
              <span>{cl}</span>
            </div>
          ))}
        </div>
        <p className="prose">
          Cada apartado establece los requisitos para implementar y mantener un Sistema de Gestión de la Calidad eficaz, mejorar el desempeño, fortalecer los procesos y aumentar la satisfacción de los clientes.
        </p>
        <ul className="ilist">
          {['Cumplir requisitos del cliente y normativos', 'Aumentar la satisfacción del cliente', 'Mejorar continuamente el sistema'].map((x) => (
            <li key={x}>
              <CheckCircle2 />
              {x}
            </li>
          ))}
        </ul>
      </div>
      <div className="h-sec" style={{ marginTop: 32 }}>Herramientas y técnicas</div>
      <div className="area-cards">
        {TOOLS.map((t) => (
          <div className="icard" key={t.t}>
            <span className="i-ico">
              <t.icon />
            </span>
            <div className="eyebrow" style={{ marginTop: 12 }}>{t.tag}</div>
            <div className="sec-title" style={{ fontSize: 18 }}>{t.t}</div>
            <p className="prose">{t.p}</p>
          </div>
        ))}
      </div>
      <div className="icard cta" style={{ marginTop: 20 }}>
        <div>
          <h3>¿Necesitas crear o actualizar un documento?</h3>
          <p>El área de Calidad atiende a todas las empresas del grupo.</p>
        </div>
        <Link className="ibtn light" to={`/intranet/${c.slug}/solicitudes`}>
          <RefreshCw /> Ir a solicitudes
        </Link>
      </div>
    </>
  );
}
