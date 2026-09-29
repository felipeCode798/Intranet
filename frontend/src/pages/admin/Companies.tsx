import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ClipboardList,
  ExternalLink,
  FileText,
  Flag,
  Globe,
  Home,
  LayoutGrid,
  Megaphone,
  Network,
  Palette,
  Pencil,
  Plus,
  Rocket,
  Star,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useEffect, useState, type KeyboardEvent } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { ImageSlot } from '../../components/FileUpload';
import { Empty, Loading, useToast } from '../../components/ui';
import { api, errorMessage, fileUrl } from '../../lib/api';
import { DOC_CATEGORIES, slugify } from '../../lib/format';
import { Icon, ICONS } from '../../lib/icons';
import { companyPalette, PRESET_COLORS } from '../../lib/theme';
import type { Area, Company, DirectoryUser, DocumentItem } from '../../lib/types';

export default function Companies() {
  const { isSuper, user } = useAuth();
  const { data = [], isLoading } = useQuery({ queryKey: ['companies'], queryFn: async () => (await api.get<Company[]>('/companies')).data });
  if (!isSuper && user?.companyId) return <Navigate to={`/app/empresas/${user.companyId}`} replace />;
  if (isLoading) return <Loading />;
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Empresas e intranets</h1>
          <p className="page-sub">Cada empresa del Grupo Playtech tiene su propia intranet con la misma estética y su color de marca.</p>
        </div>
        <Link className="btn dark" to="/app/empresas/nueva">
          <Plus /> Nueva empresa
        </Link>
      </div>
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        {data.map((c) => (
          <div className="card" key={c.id} style={{ padding: 0, overflow: 'hidden', opacity: c.active ? 1 : 0.6 }}>
            <div style={{ ...companyPalette(c.primaryColor, c.secondaryColor), background: 'linear-gradient(120deg, var(--navy-900), var(--navy-800) 60%, var(--brand))', padding: '22px 22px 18px', color: '#fff' } as any}>
              <div className="row between">
                {c.logoUrl ? <img src={fileUrl(c.logoUrl)} alt={c.name} style={{ height: 30, maxWidth: 140, objectFit: 'contain' }} /> : <b style={{ fontSize: 18, letterSpacing: '.03em' }}>{c.name.toUpperCase()}</b>}
                <span className="badge" style={{ background: 'rgba(255,255,255,.15)', color: '#fff' }}>/{c.slug}</span>
              </div>
              <div className="small" style={{ opacity: 0.85, marginTop: 10 }}>{c.slogan || c.legalName}</div>
            </div>
            <div style={{ padding: 18 }}>
              <div className="row" style={{ gap: 18 }}>
                {[
                  ['Usuarios', c._count?.users],
                  ['Áreas', c._count?.areas],
                  ['Solicitudes', c._count?.requests],
                ].map(([l, v]) => (
                  <div key={l as string}>
                    <div style={{ fontSize: 20, fontWeight: 700 }}>{v ?? 0}</div>
                    <div className="xs faint">{l}</div>
                  </div>
                ))}
                <span className="row xs faint" style={{ marginLeft: 'auto', gap: 5 }}>
                  <span className="dot" style={{ background: c.primaryColor, width: 12, height: 12 }} /> {c.primaryColor}
                </span>
              </div>
              <div className="row mt">
                <Link className="btn sm ghost" to={`/intranet/${c.slug}`}>
                  <ExternalLink /> Ver intranet
                </Link>
                <Link className="btn sm outline" to={`/app/empresas/${c.id}`}>
                  <Pencil /> Editar
                </Link>
              </div>
            </div>
          </div>
        ))}
        <Link to="/app/empresas/nueva" className="add-board" style={{ minHeight: 240 }}>
          <div>
            <div className="plus" style={{ margin: '0 auto' }}>
              <Plus />
            </div>
            <span>Crear intranet para una nueva empresa</span>
          </div>
        </Link>
      </div>
    </>
  );
}

// =====================================================================
// Asistente de creación / edición
// =====================================================================
type WizardData = Omit<Company, 'id' | 'active' | '_count'> & {
  sharedAreaIds: string[];
  newAreas: { name: string; description: string; icon: string; leaderId: string }[];
  admin: { name: string; email: string; password: string; jobTitle: string };
};

const EMPTY: WizardData = {
  name: '',
  slug: '',
  legalName: '',
  nit: '',
  slogan: '',
  description: '',
  primaryColor: '#1d4ed8',
  secondaryColor: '#38bdf8',
  logoUrl: null,
  heroImageUrl: null,
  missionText: '',
  missionImageUrl: null,
  visionText: '',
  visionImageUrl: null,
  objectivesText: '',
  purposeText: 'Centralizar la información, facilitar la colaboración y optimizar los procesos internos de nuestro equipo.',
  organigramUrl: null,
  managementSystem: '',
  contactEmail: '',
  website: '',
  announcements: [],
  values: [],
  sharedAreaIds: [],
  newAreas: [],
  admin: { name: '', email: '', password: '', jobTitle: 'Administrador de intranet' },
};

export function CompanyWizard() {
  const { id } = useParams();
  const isNew = !id;
  const { isSuper } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: loaded, isLoading } = useQuery({
    queryKey: ['company', id],
    enabled: !isNew,
    queryFn: async () => (await api.get<Company & { areas: { area: Area }[]; documents: DocumentItem[] }>(`/companies/${id}`)).data,
  });
  const { data: allAreas = [] } = useQuery({ queryKey: ['areas', 'all'], queryFn: async () => (await api.get<Area[]>('/areas')).data });
  const { data: people = [] } = useQuery({ queryKey: ['directory', 'all'], queryFn: async () => (await api.get<DirectoryUser[]>('/users/directory')).data, enabled: isNew });
  const sharedAreas = allAreas.filter((a) => a.isShared);

  const [d, setD] = useState<WizardData>(EMPTY);
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  useEffect(() => {
    if (loaded) {
      setD({
        ...EMPTY,
        ...Object.fromEntries(Object.entries(loaded).map(([k, v]) => [k, v ?? (EMPTY as any)[k]])),
        sharedAreaIds: loaded.areas.filter((a) => a.area.isShared).map((a) => a.area.id),
        newAreas: [],
        admin: EMPTY.admin,
      } as WizardData);
      setSlugTouched(true);
    } else if (isNew && sharedAreas.length && !d.sharedAreaIds.length) {
      setD((x) => ({ ...x, sharedAreaIds: sharedAreas.map((a) => a.id) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, isNew, sharedAreas.length]);

  const set = (patch: Partial<WizardData>) => setD((x) => ({ ...x, ...patch }));

  const STEPS = [
    { t: 'Identidad', s: 'Nombre y datos legales', icon: Building2 },
    { t: 'Marca y color', s: 'Color, logo y portada', icon: Palette },
    { t: 'Estrategia', s: 'Misión, visión, objetivos', icon: Flag },
    { t: 'Contenido', s: 'Anuncios y organigrama', icon: Megaphone },
    { t: 'Áreas', s: 'Compartidas y propias', icon: Network },
    ...(isNew ? [{ t: 'Administrador', s: 'Quién gestiona la intranet', icon: UserPlus }] : [{ t: 'Documentos', s: 'Documentación publicada', icon: FileText }]),
    { t: 'Revisión', s: isNew ? 'Confirmar y crear' : 'Guardar cambios', icon: Rocket },
  ];

  const validate = (i: number): string | null => {
    if (i === 0) {
      if (d.name.trim().length < 2) return 'Escribe el nombre de la empresa';
      if (!/^[a-z0-9-]{2,}$/.test(d.slug)) return 'El identificador solo admite minúsculas, números y guiones';
    }
    if (i === 5 && isNew && (d.admin.email || d.admin.name || d.admin.password)) {
      if (d.admin.name.trim().length < 2 || !/\S+@\S+\.\S+/.test(d.admin.email) || d.admin.password.length < 8)
        return 'Completa nombre, correo y una contraseña de al menos 8 caracteres (o deja el paso vacío)';
    }
    if (i === 4 && d.newAreas.some((a) => a.name.trim().length < 2)) return 'Cada área nueva necesita un nombre';
    return null;
  };
  const goto = (i: number) => {
    if (i > step) {
      for (let s = step; s < i; s++) {
        const err = validate(s);
        if (err) {
          setStep(s);
          return toast(err, 'error');
        }
      }
    }
    setDone((x) => new Set([...x, ...Array.from({ length: i }, (_, k) => k)]));
    setStep(i);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async () => {
    for (let s = 0; s < STEPS.length - 1; s++) {
      const err = validate(s);
      if (err) {
        setStep(s);
        return toast(err, 'error');
      }
    }
    setSaving(true);
    const content = {
      name: d.name,
      slug: d.slug,
      legalName: d.legalName || undefined,
      nit: d.nit || undefined,
      slogan: d.slogan || undefined,
      description: d.description || undefined,
      primaryColor: d.primaryColor,
      secondaryColor: d.secondaryColor,
      logoUrl: d.logoUrl || undefined,
      heroImageUrl: d.heroImageUrl || undefined,
      missionText: d.missionText || undefined,
      missionImageUrl: d.missionImageUrl || undefined,
      visionText: d.visionText || undefined,
      visionImageUrl: d.visionImageUrl || undefined,
      objectivesText: d.objectivesText || undefined,
      purposeText: d.purposeText || undefined,
      organigramUrl: d.organigramUrl || undefined,
      managementSystem: d.managementSystem || undefined,
      contactEmail: d.contactEmail || undefined,
      website: d.website || undefined,
      announcements: d.announcements,
      values: d.values,
    };
    try {
      if (isNew) {
        const { data } = await api.post<Company>('/companies', {
          ...content,
          sharedAreaIds: d.sharedAreaIds,
          newAreas: d.newAreas.map((a) => ({ ...a, leaderId: a.leaderId || undefined })),
          admin: d.admin.email ? d.admin : undefined,
        });
        toast(`Intranet de ${data.name} creada`);
        qc.invalidateQueries({ queryKey: ['companies'] });
        nav(`/intranet/${data.slug}`);
      } else {
        // en edición los campos vacíos se guardan como null para permitir borrar imágenes/textos
        const nulled = Object.fromEntries(Object.entries(content).map(([k, v]) => [k, v === undefined ? null : v]));
        await api.patch(`/companies/${id}`, { ...nulled, ...(isSuper ? { sharedAreaIds: d.sharedAreaIds } : {}) });
        toast('Cambios guardados');
        qc.invalidateQueries({ queryKey: ['companies'] });
        qc.invalidateQueries({ queryKey: ['company', id] });
        qc.invalidateQueries({ queryKey: ['intranet'] });
      }
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && isLoading) return <Loading />;
  const last = STEPS.length - 1;
  const current = STEPS[step];

  return (
    <>
      <div className="page-head">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          {isSuper && (
            <Link className="icon-btn" to="/app/empresas" aria-label="Volver">
              <ArrowLeft />
            </Link>
          )}
          <div>
            <h1 className="page-title">{isNew ? 'Nueva intranet' : `Intranet de ${loaded?.name}`}</h1>
            <p className="page-sub">{isNew ? 'Responde paso a paso; puedes volver a cualquier paso antes de crear.' : 'Actualiza el contenido y la marca de la intranet.'}</p>
          </div>
        </div>
        {!isNew && (
          <div className="row">
            <Link className="btn ghost" to={`/intranet/${d.slug}`}>
              <ExternalLink /> Ver intranet
            </Link>
            <button className="btn" onClick={submit} disabled={saving}>
              <Check /> Guardar
            </button>
          </div>
        )}
      </div>

      <div className="wizard">
        <nav className="card steps-nav" aria-label="Pasos">
          {STEPS.map((s, i) => (
            <button key={s.t} className={`${i === step ? 'on' : ''} ${done.has(i) && i !== step ? 'done' : ''}`} onClick={() => goto(i)}>
              <span className="n">{done.has(i) && i !== step ? <Check /> : i + 1}</span>
              <span>
                {s.t}
                <small>{s.s}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="card">
          <div className="wiz-progress">
            <i style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>
          <div className="row" style={{ marginBottom: 20 }}>
            <span className="ico-box">
              <current.icon />
            </span>
            <div>
              <div className="xs faint">
                Paso {step + 1} de {STEPS.length}
              </div>
              <h2 style={{ fontSize: 21 }}>{current.t}</h2>
            </div>
          </div>

          {step === 0 && (
            <div className="form-grid">
              <div className="field">
                <label>¿Cómo se llama la empresa?<span className="req">*</span></label>
                <input
                  className="input"
                  value={d.name}
                  placeholder="Ej.: Enjambre"
                  onChange={(e) => set({ name: e.target.value, ...(slugTouched ? {} : { slug: slugify(e.target.value) }) })}
                  autoFocus
                />
              </div>
              <div className="field">
                <label>Dirección de la intranet<span className="req">*</span></label>
                <input
                  className="input"
                  value={d.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set({ slug: slugify(e.target.value) });
                  }}
                />
                <span className="help">{location.origin}/intranet/{d.slug || 'empresa'}</span>
              </div>
              <div className="field">
                <label>Razón social</label>
                <input className="input" value={d.legalName || ''} onChange={(e) => set({ legalName: e.target.value })} placeholder="Empresa S.A.S." />
              </div>
              <div className="field">
                <label>NIT</label>
                <input className="input" value={d.nit || ''} onChange={(e) => set({ nit: e.target.value })} placeholder="900.000.000-0" />
              </div>
              <div className="field full">
                <label>Eslogan (aparece en la intranet)</label>
                <input className="input" value={d.slogan || ''} onChange={(e) => set({ slogan: e.target.value })} />
              </div>
              <div className="field full">
                <label>¿A qué se dedica la empresa?</label>
                <textarea className="textarea" value={d.description || ''} onChange={(e) => set({ description: e.target.value })} />
              </div>
              <div className="field">
                <label>Correo de contacto de la intranet</label>
                <input className="input" type="email" value={d.contactEmail || ''} onChange={(e) => set({ contactEmail: e.target.value })} />
              </div>
              <div className="field">
                <label>Sitio web</label>
                <input className="input" value={d.website || ''} onChange={(e) => set({ website: e.target.value })} placeholder="https://" />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div className="stack" style={{ gap: 18 }}>
                <div className="field">
                  <label>¿De qué color quieres la intranet?</label>
                  <div className="color-row">
                    {PRESET_COLORS.map((c) => (
                      <button key={c} type="button" className={`swatch ${d.primaryColor === c ? 'on' : ''}`} style={{ background: c }} onClick={() => set({ primaryColor: c })} aria-label={c} />
                    ))}
                  </div>
                  <div className="color-input mt-sm">
                    <input type="color" value={d.primaryColor} onChange={(e) => set({ primaryColor: e.target.value })} aria-label="Color principal personalizado" />
                    <input className="input sm" style={{ width: 120 }} value={d.primaryColor} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && set({ primaryColor: e.target.value })} />
                    <span className="small faint">Color principal</span>
                  </div>
                </div>
                <div className="field">
                  <label>Color de acento</label>
                  <div className="color-input">
                    <input type="color" value={d.secondaryColor} onChange={(e) => set({ secondaryColor: e.target.value })} aria-label="Color de acento" />
                    <input className="input sm" style={{ width: 120 }} value={d.secondaryColor} onChange={(e) => /^#[0-9a-fA-F]{0,6}$/.test(e.target.value) && set({ secondaryColor: e.target.value })} />
                    <span className="small faint">Brillos e íconos destacados</span>
                  </div>
                </div>
                <ImageSlot label="Logo (versión clara, fondo transparente)" hint="PNG o SVG, se muestra sobre fondo oscuro" value={d.logoUrl} onChange={(u) => set({ logoUrl: u })} height={110} contain />
                <ImageSlot label="Imagen de portada (tarjeta de bienvenida)" hint="Opcional · 1600×600 px" value={d.heroImageUrl} onChange={(u) => set({ heroImageUrl: u })} height={120} />
              </div>
              <div>
                <div className="label" style={{ marginBottom: 8 }}>Vista previa</div>
                <IntranetPreview d={d} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="stack" style={{ gap: 18 }}>
              <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>
                <div className="field">
                  <label>Misión</label>
                  <textarea className="textarea" style={{ minHeight: 150 }} value={d.missionText || ''} onChange={(e) => set({ missionText: e.target.value })} placeholder="¿Qué hace la empresa, para quién y cómo?" />
                </div>
                <ImageSlot label="Imagen de la misión" value={d.missionImageUrl} onChange={(u) => set({ missionImageUrl: u })} />
              </div>
              <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 18 }}>
                <div className="field">
                  <label>Visión</label>
                  <textarea className="textarea" style={{ minHeight: 150 }} value={d.visionText || ''} onChange={(e) => set({ visionText: e.target.value })} placeholder="¿Dónde quiere estar la empresa y en qué año?" />
                </div>
                <ImageSlot label="Imagen de la visión" value={d.visionImageUrl} onChange={(u) => set({ visionImageUrl: u })} />
              </div>
              <div className="field">
                <label>Objetivos estratégicos</label>
                <textarea className="textarea" value={d.objectivesText || ''} onChange={(e) => set({ objectivesText: e.target.value })} />
              </div>
              <div className="field">
                <label>Propósito de la intranet</label>
                <textarea className="textarea" style={{ minHeight: 80 }} value={d.purposeText || ''} onChange={(e) => set({ purposeText: e.target.value })} />
              </div>
              <div className="field">
                <label>Valores corporativos</label>
                <TagInput value={d.values} onChange={(v) => set({ values: v })} placeholder="Escribe un valor y presiona Enter" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="stack" style={{ gap: 18 }}>
              <div className="field">
                <label>Anuncios del inicio</label>
                <span className="help">Rotan en la barra de anuncios de la intranet.</span>
                {d.announcements.map((a, i) => (
                  <div className="opt-row" key={i}>
                    <input className="input" value={a} onChange={(e) => set({ announcements: d.announcements.map((x, j) => (j === i ? e.target.value : x)) })} />
                    <button className="icon-btn sm" onClick={() => set({ announcements: d.announcements.filter((_, j) => j !== i) })} aria-label="Quitar">
                      <Trash2 />
                    </button>
                  </div>
                ))}
                <button className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => set({ announcements: [...d.announcements, ''] })}>
                  <Plus /> Agregar anuncio
                </button>
              </div>
              <div className="field">
                <label>Sistema de gestión / normas que aplica</label>
                <input className="input" value={d.managementSystem || ''} onChange={(e) => set({ managementSystem: e.target.value })} placeholder="Ej.: NTC ISO 9001:2015" />
              </div>
              <ImageSlot label="Organigrama" hint="Imagen del organigrama (se puede ampliar en la intranet)" value={d.organigramUrl} onChange={(u) => set({ organigramUrl: u })} height={220} contain />
            </div>
          )}

          {step === 4 && (
            <div className="stack" style={{ gap: 20 }}>
              <div>
                <div className="bold">Áreas compartidas del holding</div>
                <p className="small faint" style={{ marginBottom: 10 }}>
                  Selecciona las áreas transversales que atenderán solicitudes de esta empresa{!isSuper && ' (solo el superadministrador puede cambiarlas)'}.
                </p>
                <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                  {sharedAreas.map((a) => {
                    const on = d.sharedAreaIds.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className={`select-card ${on ? 'on' : ''}`}
                        disabled={!isSuper}
                        onClick={() => set({ sharedAreaIds: on ? d.sharedAreaIds.filter((x) => x !== a.id) : [...d.sharedAreaIds, a.id] })}
                      >
                        <span className="ico-box">
                          <Icon name={a.icon} />
                        </span>
                        <div style={{ textAlign: 'left' }}>
                          <b>{a.name}</b>
                          <small>{a.members.filter((m) => m.role === 'LEADER').map((m) => m.user.name).join(', ') || 'Sin líder'}</small>
                        </div>
                        <span className="tick">{on && <Check />}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {isNew ? (
                <div>
                  <div className="bold">Áreas propias de la empresa</div>
                  <p className="small faint" style={{ marginBottom: 10 }}>Agrega las áreas internas. Puedes asignar el líder ahora o después en la sección Áreas.</p>
                  <div className="stack">
                    {d.newAreas.map((a, i) => (
                      <div key={i} className="card flat" style={{ padding: 14 }}>
                        <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
                          <div className="field">
                            <label>Nombre</label>
                            <input className="input" value={a.name} onChange={(e) => set({ newAreas: d.newAreas.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
                          </div>
                          <div className="field">
                            <label>Líder</label>
                            <select className="select" value={a.leaderId} onChange={(e) => set({ newAreas: d.newAreas.map((x, j) => (j === i ? { ...x, leaderId: e.target.value } : x)) })}>
                              <option value="">Asignar después</option>
                              {people.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} · {p.company?.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <button className="icon-btn" style={{ alignSelf: 'end' }} onClick={() => set({ newAreas: d.newAreas.filter((_, j) => j !== i) })} aria-label="Quitar área">
                            <Trash2 />
                          </button>
                          <div className="field" style={{ gridColumn: '1 / -1' }}>
                            <label>Descripción</label>
                            <input className="input" value={a.description} onChange={(e) => set({ newAreas: d.newAreas.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)) })} />
                          </div>
                          <div className="row wrap" style={{ gridColumn: '1 / -1', gap: 4 }}>
                            {Object.keys(ICONS).slice(0, 18).map((k) => (
                              <button
                                key={k}
                                type="button"
                                className="icon-btn sm"
                                style={a.icon === k ? { background: 'var(--p-soft)', color: 'var(--p-600)', boxShadow: '0 0 0 2px var(--p)' } : undefined}
                                onClick={() => set({ newAreas: d.newAreas.map((x, j) => (j === i ? { ...x, icon: k } : x)) })}
                              >
                                <Icon name={k} />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                    <button className="btn ghost" style={{ alignSelf: 'flex-start' }} onClick={() => set({ newAreas: [...d.newAreas, { name: '', description: '', icon: 'folder', leaderId: '' }] })}>
                      <Plus /> Agregar área
                    </button>
                  </div>
                </div>
              ) : (
                <div className="card flat row between">
                  <span className="small">Las áreas propias, sus líderes y colaboradores se gestionan en la sección Áreas.</span>
                  <Link className="btn sm ghost" to="/app/areas">
                    <Network /> Ir a Áreas
                  </Link>
                </div>
              )}
            </div>
          )}

          {step === 5 && isNew && (
            <div className="stack" style={{ gap: 16 }}>
              <p className="small muted">Opcional: crea el usuario que administrará el contenido y los usuarios de esta intranet.</p>
              <div className="form-grid">
                <div className="field">
                  <label>Nombre completo</label>
                  <input className="input" value={d.admin.name} onChange={(e) => set({ admin: { ...d.admin, name: e.target.value } })} />
                </div>
                <div className="field">
                  <label>Cargo</label>
                  <input className="input" value={d.admin.jobTitle} onChange={(e) => set({ admin: { ...d.admin, jobTitle: e.target.value } })} />
                </div>
                <div className="field">
                  <label>Correo</label>
                  <input className="input" type="email" value={d.admin.email} onChange={(e) => set({ admin: { ...d.admin, email: e.target.value } })} />
                </div>
                <div className="field">
                  <label>Contraseña inicial</label>
                  <input className="input" type="password" value={d.admin.password} onChange={(e) => set({ admin: { ...d.admin, password: e.target.value } })} placeholder="Mínimo 8 caracteres" />
                </div>
              </div>
            </div>
          )}

          {step === 5 && !isNew && id && <DocumentsManager companyId={id} />}

          {step === last && (
            <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <dl className="review-grid">
                <dt>Empresa</dt>
                <dd className="bold">{d.name}</dd>
                <dt>Intranet</dt>
                <dd>/intranet/{d.slug}</dd>
                <dt>Razón social · NIT</dt>
                <dd>
                  {d.legalName || '—'} · {d.nit || '—'}
                </dd>
                <dt>Color</dt>
                <dd className="row" style={{ gap: 6 }}>
                  <span className="dot" style={{ background: d.primaryColor, width: 14, height: 14 }} /> {d.primaryColor}
                  <span className="dot" style={{ background: d.secondaryColor, width: 14, height: 14, marginLeft: 8 }} /> {d.secondaryColor}
                </dd>
                <dt>Misión / visión</dt>
                <dd>{d.missionText ? '✓' : '—'} / {d.visionText ? '✓' : '—'}</dd>
                <dt>Imágenes</dt>
                <dd>{[d.logoUrl && 'logo', d.heroImageUrl && 'portada', d.missionImageUrl && 'misión', d.visionImageUrl && 'visión', d.organigramUrl && 'organigrama'].filter(Boolean).join(', ') || 'ninguna'}</dd>
                <dt>Anuncios · valores</dt>
                <dd>
                  {d.announcements.filter(Boolean).length} · {d.values.length}
                </dd>
                <dt>Áreas compartidas</dt>
                <dd>{sharedAreas.filter((a) => d.sharedAreaIds.includes(a.id)).map((a) => a.name).join(', ') || 'ninguna'}</dd>
                {isNew && (
                  <>
                    <dt>Áreas propias</dt>
                    <dd>{d.newAreas.map((a) => a.name).join(', ') || 'ninguna'}</dd>
                    <dt>Administrador</dt>
                    <dd>{d.admin.email || 'sin crear'}</dd>
                  </>
                )}
              </dl>
              <IntranetPreview d={d} />
            </div>
          )}

          <div className="wiz-foot">
            <button className="btn outline" disabled={step === 0} onClick={() => goto(step - 1)}>
              <ArrowLeft /> Anterior
            </button>
            {step < last ? (
              <button className="btn" onClick={() => goto(step + 1)}>
                Siguiente <ArrowRight />
              </button>
            ) : (
              <button className="btn dark" onClick={submit} disabled={saving}>
                <Rocket /> {saving ? 'Guardando…' : isNew ? 'Crear intranet' : 'Guardar cambios'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [t, setT] = useState('');
  const add = () => {
    const v = t.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setT('');
  };
  return (
    <div className="tag-input">
      {value.map((v) => (
        <span key={v} className="badge tone-violet lg">
          <Star /> {v}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Quitar ${v}`}>
            <X />
          </button>
        </span>
      ))}
      <input
        value={t}
        placeholder={placeholder}
        onChange={(e) => setT(e.target.value)}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
    </div>
  );
}

/** Miniatura de la intranet con la paleta generada */
function IntranetPreview({ d }: { d: Pick<WizardData, 'name' | 'primaryColor' | 'secondaryColor' | 'logoUrl' | 'slogan' | 'heroImageUrl'> }) {
  const pal = companyPalette(d.primaryColor, d.secondaryColor);
  return (
    <div className="preview-frame intranet" style={{ ...pal, minHeight: 0 } as any}>
      <div className="i-topbar" style={{ position: 'static' }}>
        <div className="wrap" style={{ height: 50, padding: '0 14px', gap: 12 }}>
          <span className="i-logo">
            {d.logoUrl ? <img src={fileUrl(d.logoUrl)} alt="" style={{ height: 24 }} /> : <span className="word" style={{ fontSize: 14 }}>{(d.name || 'EMPRESA').toUpperCase()}</span>}
            <span className="tag" style={{ fontSize: 9 }}>Intranet</span>
          </span>
        </div>
      </div>
      <div className="i-nav" style={{ position: 'static' }}>
        <div className="wrap" style={{ padding: '0 10px' }}>
          {['Inicio', 'Solicitudes', 'Estrategia', 'Documentación'].map((x, i) => (
            <a key={x} className={i === 0 ? 'active' : ''} style={{ padding: '10px 8px', fontSize: 11 }}>
              {i === 0 && <Home size={13} />} {x}
            </a>
          ))}
        </div>
      </div>
      <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div
          className="icard welcome"
          style={{ minHeight: 110, padding: 14, gap: 10, ...(d.heroImageUrl ? { backgroundImage: `linear-gradient(135deg, color-mix(in srgb, var(--navy-800) 90%, transparent), color-mix(in srgb, var(--brand) 70%, transparent)), url(${fileUrl(d.heroImageUrl)})`, backgroundSize: 'cover' } : {}) }}
        >
          <div className="mega" style={{ width: 42, height: 42, borderRadius: 12 }}>
            <Megaphone size={20} />
          </div>
          <div>
            <b style={{ fontSize: 13 }}>¡Buenos días!</b>
            <div style={{ fontSize: 10, opacity: 0.8 }}>{d.slogan || 'Bienvenido(a)'}</div>
          </div>
        </div>
        <div className="icard" style={{ padding: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {[ClipboardList, Flag, LayoutGrid, Globe].map((I, i) => (
            <div key={i} className={`tile ${i === 0 ? 'featured' : ''}`} style={{ minHeight: 44, padding: 6 }}>
              <I size={15} />
            </div>
          ))}
        </div>
      </div>
      <div style={{ padding: '0 14px 14px' }}>
        <button className="ibtn" style={{ fontSize: 11, padding: '7px 12px' }}>Crear una solicitud</button>
      </div>
    </div>
  );
}

function DocumentsManager({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { data } = useQuery({ queryKey: ['company', companyId] , queryFn: async () => (await api.get<Company & { documents: DocumentItem[] }>(`/companies/${companyId}`)).data });
  const [doc, setDoc] = useState({ title: '', url: '', category: 'documentos', process: '', featured: false });
  const docs = data?.documents || [];
  const add = async () => {
    if (doc.title.trim().length < 2 || !doc.url.trim()) return toast('Escribe el nombre y el enlace del documento', 'error');
    try {
      await api.post(`/companies/${companyId}/documents`, { ...doc, process: doc.process || undefined });
      setDoc({ ...doc, title: '', url: '' });
      qc.invalidateQueries({ queryKey: ['company', companyId] });
      qc.invalidateQueries({ queryKey: ['intranet'] });
      toast('Documento publicado');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const remove = async (id: string) => {
    await api.delete(`/companies/documents/${id}`);
    qc.invalidateQueries({ queryKey: ['company', companyId] });
    qc.invalidateQueries({ queryKey: ['intranet'] });
  };
  const toggleFeatured = async (dd: DocumentItem) => {
    await api.patch(`/companies/documents/${dd.id}`, { title: dd.title, url: dd.url, featured: !dd.featured });
    qc.invalidateQueries({ queryKey: ['company', companyId] });
    qc.invalidateQueries({ queryKey: ['intranet'] });
  };
  return (
    <div className="stack" style={{ gap: 16 }}>
      <p className="small muted">Los documentos se publican con un enlace (por ejemplo, Google Drive). Los destacados aparecen en “Documentos clave” del inicio.</p>
      <div className="card flat">
        <div className="form-grid" style={{ gridTemplateColumns: '1.3fr 1fr 1fr' }}>
          <div className="field">
            <label>Nombre del documento</label>
            <input className="input" value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} />
          </div>
          <div className="field">
            <label>Categoría</label>
            <select className="select" value={doc.category} onChange={(e) => setDoc({ ...doc, category: e.target.value })}>
              {Object.entries(DOC_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Proceso</label>
            <input className="input" value={doc.process} onChange={(e) => setDoc({ ...doc, process: e.target.value })} placeholder="Ej.: Gestión Estratégica" />
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>Enlace</label>
            <input className="input" value={doc.url} onChange={(e) => setDoc({ ...doc, url: e.target.value })} placeholder="https://drive.google.com/…" />
          </div>
          <div className="field" style={{ justifyContent: 'flex-end' }}>
            <label className="check">
              <input type="checkbox" checked={doc.featured} onChange={(e) => setDoc({ ...doc, featured: e.target.checked })} /> Destacado en el inicio
            </label>
          </div>
        </div>
        <div className="row mt-sm" style={{ justifyContent: 'flex-end' }}>
          <button className="btn sm" onClick={add}>
            <Plus /> Publicar documento
          </button>
        </div>
      </div>
      {docs.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Documento</th>
                <th>Categoría</th>
                <th>Proceso</th>
                <th>Destacado</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {docs.map((x) => (
                <tr key={x.id}>
                  <td>
                    <a href={x.url} target="_blank" rel="noreferrer" className="bold">
                      {x.title}
                    </a>
                  </td>
                  <td>{DOC_CATEGORIES[x.category] || x.category}</td>
                  <td className="small">{x.process || '—'}</td>
                  <td>
                    <button className={`badge ${x.featured ? 'tone-violet' : 'tone-gray'}`} onClick={() => toggleFeatured(x)}>
                      <Star /> {x.featured ? 'Sí' : 'No'}
                    </button>
                  </td>
                  <td>
                    <button className="icon-btn sm" onClick={() => remove(x.id)} aria-label="Eliminar">
                      <Trash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty title="Sin documentos" text="Publica el primer documento de la intranet." icon={<FileText />} />
      )}
    </div>
  );
}
