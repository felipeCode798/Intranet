import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlignLeft,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  AtSign,
  CalendarDays,
  ChevronDown,
  CircleDot,
  Clock,
  Copy,
  Eye,
  FilePen,
  GripVertical,
  Hash,
  Heading,
  Paperclip,
  Pencil,
  Plus,
  Save,
  SquareCheck,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { DynamicForm } from '../../components/DynamicForm';
import { Empty, Loading, Modal, Switch, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { fmtDate, PRIORITY } from '../../lib/format';
import { Icon, ICONS } from '../../lib/icons';
import type { Area, FieldType, FormField, Priority, RequestForm } from '../../lib/types';

const FIELD_TYPES: { type: FieldType; label: string; icon: typeof Type; hint: string }[] = [
  { type: 'text', label: 'Texto corto', icon: Type, hint: 'Una línea' },
  { type: 'textarea', label: 'Párrafo', icon: AlignLeft, hint: 'Texto largo' },
  { type: 'number', label: 'Número', icon: Hash, hint: 'Valores, cantidades' },
  { type: 'email', label: 'Correo', icon: AtSign, hint: 'Correo electrónico' },
  { type: 'date', label: 'Fecha', icon: CalendarDays, hint: 'Selector de fecha' },
  { type: 'select', label: 'Lista desplegable', icon: ChevronDown, hint: 'Una opción de una lista' },
  { type: 'radio', label: 'Opción única', icon: CircleDot, hint: 'Botones de opción' },
  { type: 'checkbox', label: 'Casillas', icon: SquareCheck, hint: 'Varias opciones' },
  { type: 'file', label: 'Adjuntos', icon: Paperclip, hint: 'Archivos' },
  { type: 'section', label: 'Título de sección', icon: Heading, hint: 'Separa el formulario' },
];
const typeInfo = (t: FieldType) => FIELD_TYPES.find((x) => x.type === t)!;

export default function Forms() {
  const { isSuper, leaderAreaIds } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: forms, isLoading } = useQuery({ queryKey: ['forms', 'manage'], queryFn: async () => (await api.get<RequestForm[]>('/forms', { params: { manage: true } })).data });
  const { data: areas = [] } = useQuery({ queryKey: ['areas', 'mine'], queryFn: async () => (await api.get<Area[]>('/areas/mine')).data });
  const led = areas.filter((a) => isSuper || leaderAreaIds.includes(a.id));
  const [pickArea, setPickArea] = useState(false);

  const grouped = useMemo(() => {
    const m = new Map<string, { area: RequestForm['area']; forms: RequestForm[] }>();
    (forms || []).forEach((f) => {
      const e = m.get(f.areaId) || { area: f.area, forms: [] };
      e.forms.push(f);
      m.set(f.areaId, e);
    });
    return [...m.values()];
  }, [forms]);

  const toggle = async (f: RequestForm) => {
    try {
      await api.patch(`/forms/${f.id}`, { active: !f.active });
      qc.invalidateQueries({ queryKey: ['forms'] });
      toast(f.active ? 'Formulario oculto de la intranet' : 'Formulario publicado');
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  };
  const duplicate = async (f: RequestForm) => {
    const { data } = await api.post(`/forms/${f.id}/duplicate`);
    qc.invalidateQueries({ queryKey: ['forms'] });
    nav(`/app/formularios/${data.id}`);
  };
  const remove = async (f: RequestForm) => {
    if (!confirm(`¿Eliminar "${f.name}"? Si tiene solicitudes solo se desactivará.`)) return;
    const { data } = await api.delete(`/forms/${f.id}`);
    qc.invalidateQueries({ queryKey: ['forms'] });
    toast(data.deactivated ? 'Tiene solicitudes: se desactivó' : 'Formulario eliminado');
  };

  if (isLoading) return <Loading />;
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Formularios de solicitud</h1>
          <p className="page-sub">Cada tipo de solicitud tiene su propio formulario y plazo de respuesta. Solo el líder del área puede editarlos.</p>
        </div>
        <button className="btn dark" onClick={() => (led.length === 1 ? nav(`/app/formularios/nuevo?areaId=${led[0].id}`) : setPickArea(true))} disabled={!led.length}>
          <Plus /> Nuevo formulario
        </button>
      </div>
      {!grouped.length && <div className="card"><Empty title="Aún no hay formularios" text="Crea el primer tipo de solicitud para tu área." icon={<FilePen />} /></div>}
      <div className="stack" style={{ gap: 20 }}>
        {grouped.map((g) => (
          <div className="card" key={g.area?.id}>
            <div className="card-h">
              <div className="row">
                <span className="ico-box">
                  <Icon name={g.area?.icon} />
                </span>
                <div>
                  <h3>{g.area?.name}</h3>
                  <span className="xs faint">{g.area?.isShared ? 'Área compartida del holding' : 'Área de empresa'}</span>
                </div>
              </div>
              <Link className="btn sm ghost" to={`/app/formularios/nuevo?areaId=${g.area?.id}`}>
                <Plus /> Agregar
              </Link>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tipo de solicitud</th>
                    <th>Plazo</th>
                    <th>Campos</th>
                    <th>Solicitudes</th>
                    <th>Actualizado</th>
                    <th>Publicado</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {g.forms.map((f) => (
                    <tr key={f.id}>
                      <td>
                        <div className="row">
                          <span className="ico-box sm">
                            <Icon name={f.icon} />
                          </span>
                          <div>
                            <div className="bold">{f.name}</div>
                            <div className="xs faint">versión {f.version}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge tone-violet">
                          <Clock /> {f.slaDays} día(s) hábil(es)
                        </span>
                      </td>
                      <td>{f.fields.length}</td>
                      <td>{f._count?.requests ?? 0}</td>
                      <td className="small">{fmtDate(f.updatedAt)}</td>
                      <td>
                        <Switch on={f.active} onChange={() => toggle(f)} />
                      </td>
                      <td>
                        <div className="row" style={{ gap: 2, justifyContent: 'flex-end' }}>
                          <Link className="icon-btn sm" to={`/app/formularios/${f.id}`} title="Editar">
                            <Pencil />
                          </Link>
                          <button className="icon-btn sm" onClick={() => duplicate(f)} title="Duplicar">
                            <Copy />
                          </button>
                          <button className="icon-btn sm" onClick={() => remove(f)} title="Eliminar">
                            <Trash2 />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      {pickArea && (
        <Modal title="¿Para qué área es el formulario?" onClose={() => setPickArea(false)}>
          <div className="stack">
            {led.map((a) => (
              <button key={a.id} className="select-card" onClick={() => nav(`/app/formularios/nuevo?areaId=${a.id}`)}>
                <span className="ico-box">
                  <Icon name={a.icon} />
                </span>
                <div style={{ textAlign: 'left' }}>
                  <b>{a.name}</b>
                  <small>{a.isShared ? 'Compartida' : a.companies.map((c) => c.company.name).join(', ')}</small>
                </div>
              </button>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

// =====================================================================
// Constructor de formularios
// =====================================================================
const newField = (type: FieldType): FormField => ({
  id: `f_${Math.random().toString(36).slice(2, 8)}`,
  type,
  label: type === 'section' ? 'Nueva sección' : typeInfo(type).label,
  required: false,
  width: 'full',
  options: ['select', 'radio', 'checkbox'].includes(type) ? ['Opción 1', 'Opción 2'] : undefined,
});

export function FormBuilder() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const isNew = !id;
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: loaded, isLoading } = useQuery({ queryKey: ['form', id], enabled: !isNew, queryFn: async () => (await api.get<RequestForm>(`/forms/${id}`)).data });
  const { data: areas = [] } = useQuery({ queryKey: ['areas', 'mine'], queryFn: async () => (await api.get<Area[]>('/areas/mine')).data });

  const [form, setForm] = useState({ name: '', description: '', icon: 'file-text', slaDays: 5, defaultPriority: 'MEDIUM' as Priority, active: true, areaId: sp.get('areaId') || '' });
  const [fields, setFields] = useState<FormField[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [dropNew, setDropNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (loaded) {
      setForm({ name: loaded.name, description: loaded.description || '', icon: loaded.icon, slaDays: loaded.slaDays, defaultPriority: loaded.defaultPriority, active: loaded.active, areaId: loaded.areaId });
      setFields(loaded.fields);
    }
  }, [loaded]);
  useEffect(() => {
    if (isNew && !fields.length) setFields([{ ...newField('textarea'), label: 'Describe tu solicitud', required: true }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNew]);

  const update = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };
  const updateFields = (fs: FormField[]) => {
    setFields(fs);
    setDirty(true);
  };
  const add = (type: FieldType, at?: number) => {
    const f = newField(type);
    const fs = [...fields];
    fs.splice(at ?? fs.length, 0, f);
    updateFields(fs);
    setSel(f.id);
  };
  const patchField = (fid: string, patch: Partial<FormField>) => updateFields(fields.map((f) => (f.id === fid ? { ...f, ...patch } : f)));
  const move = (from: number, to: number) => {
    if (to < 0 || to >= fields.length || from === to) return;
    const fs = [...fields];
    const [x] = fs.splice(from, 1);
    fs.splice(to, 0, x);
    updateFields(fs);
  };

  const onDropCanvas = (e: DragEvent, at: number) => {
    e.preventDefault();
    const t = e.dataTransfer.getData('new-field') as FieldType;
    if (t) add(t, at);
    else if (dragIdx !== null) move(dragIdx, at > dragIdx ? at - 1 : at);
    setDragIdx(null);
    setOverIdx(null);
    setDropNew(false);
  };

  const save = async () => {
    if (form.name.trim().length < 3) return toast('Escribe el nombre del formulario', 'error');
    if (!form.areaId) return toast('Selecciona el área', 'error');
    setSaving(true);
    try {
      const body = { ...form, fields };
      const { data } = isNew ? await api.post('/forms', body) : await api.patch(`/forms/${id}`, { ...body, areaId: undefined });
      toast(isNew ? 'Formulario creado' : 'Cambios guardados');
      setDirty(false);
      qc.invalidateQueries({ queryKey: ['forms'] });
      qc.invalidateQueries({ queryKey: ['intranet'] });
      if (isNew) nav(`/app/formularios/${data.id}`, { replace: true });
      else qc.invalidateQueries({ queryKey: ['form', id] });
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!isNew && isLoading) return <Loading />;
  const selected = fields.find((f) => f.id === sel);
  const area = areas.find((a) => a.id === form.areaId);

  return (
    <>
      <div className="page-head">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <Link className="icon-btn" to="/app/formularios" aria-label="Volver">
            <ArrowLeft />
          </Link>
          <div>
            <h1 className="page-title">{isNew ? 'Nuevo formulario' : form.name || 'Formulario'}</h1>
            <p className="page-sub">
              {area ? `Área: ${area.name}` : 'Selecciona el área'} · Los cambios aplican a las nuevas solicitudes; las anteriores conservan su versión.
            </p>
          </div>
        </div>
        <div className="row">
          <button className={`btn ${preview ? 'ghost' : 'outline'}`} onClick={() => setPreview(!preview)}>
            <Eye /> {preview ? 'Volver a editar' : 'Vista previa'}
          </button>
          <button className="btn" onClick={save} disabled={saving}>
            <Save /> {saving ? 'Guardando…' : dirty ? 'Guardar cambios' : 'Guardado'}
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="form-grid" style={{ gridTemplateColumns: '1.3fr 1fr 1fr' }}>
          <div className="field">
            <label>Nombre del tipo de solicitud</label>
            <input className="input" value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="Ej.: Revisión de contrato" />
          </div>
          <div className="field">
            <label>Área</label>
            <select className="select" value={form.areaId} disabled={!isNew} onChange={(e) => update({ areaId: e.target.value })}>
              <option value="">Selecciona</option>
              {areas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Prioridad predeterminada</label>
            <select className="select" value={form.defaultPriority} onChange={(e) => update({ defaultPriority: e.target.value as Priority })}>
              {(Object.keys(PRIORITY) as Priority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY[p].label}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ gridColumn: 'span 2' }}>
            <label>Descripción (se muestra al solicitante)</label>
            <input className="input" value={form.description} onChange={(e) => update({ description: e.target.value })} placeholder="¿Cuándo se usa esta solicitud?" />
          </div>
          <div className="field">
            <label>Plazo de respuesta (días hábiles)</label>
            <div className="sla-picker">
              <input type="range" min={1} max={30} value={form.slaDays} onChange={(e) => update({ slaDays: Number(e.target.value) })} aria-label="Plazo en días hábiles" />
              <input className="input sm" type="number" min={1} max={90} value={form.slaDays} onChange={(e) => update({ slaDays: Math.max(1, Number(e.target.value) || 1) })} style={{ width: 70 }} />
            </div>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <label>Ícono</label>
            <div className="row wrap" style={{ gap: 6 }}>
              {Object.keys(ICONS).map((k) => (
                <button key={k} type="button" className={`icon-btn ${form.icon === k ? 'tone-violet' : ''}`} style={form.icon === k ? { boxShadow: '0 0 0 2px var(--p)' } : undefined} onClick={() => update({ icon: k })} title={k}>
                  <Icon name={k} />
                </button>
              ))}
            </div>
          </div>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            <Switch on={form.active} onChange={(v) => update({ active: v })} label={form.active ? 'Publicado en las intranets de las empresas que atiende el área' : 'Oculto (borrador)'} />
          </div>
        </div>
      </div>

      {preview ? (
        <div className="card" style={{ maxWidth: 820, margin: '0 auto' }}>
          <div className="row" style={{ marginBottom: 18 }}>
            <span className="ico-box">
              <Icon name={form.icon} />
            </span>
            <div>
              <h3 style={{ fontSize: 19 }}>{form.name || 'Sin nombre'}</h3>
              <div className="small faint">
                {form.description} · Respuesta en {form.slaDays} día(s) hábil(es)
              </div>
            </div>
          </div>
          <DynamicForm fields={fields} values={previewValues} onChange={setPreviewValues} />
        </div>
      ) : (
        <div className="builder">
          <div className="palette-list">
            <div className="small bold muted" style={{ padding: '0 4px 4px' }}>
              Arrastra o haz clic para agregar
            </div>
            {FIELD_TYPES.map((t) => (
              <button
                key={t.type}
                className="palette-item"
                draggable
                onDragStart={(e) => e.dataTransfer.setData('new-field', t.type)}
                onClick={() => add(t.type)}
                title={t.hint}
              >
                <span className="ico-box">
                  <t.icon />
                </span>
                {t.label}
              </button>
            ))}
          </div>

          <div className="card canvas">
            <div className="card-h">
              <h3>Campos del formulario</h3>
              <span className="xs faint">{fields.length} campo(s) · el asunto y la prioridad se piden siempre</span>
            </div>
            <div className="canvas-fields">
              {fields.map((f, i) => {
                const TI = typeInfo(f.type);
                return (
                  <div
                    key={f.id}
                    className={`canvas-field ${f.width === 'half' ? '' : 'full'} ${sel === f.id ? 'sel' : ''} ${overIdx === i ? 'drag-over' : ''}`}
                    onClick={() => setSel(f.id)}
                    draggable
                    onDragStart={() => setDragIdx(i)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setOverIdx(i);
                    }}
                    onDragLeave={() => setOverIdx(null)}
                    onDrop={(e) => onDropCanvas(e, i)}
                  >
                    <span className="grip">
                      <GripVertical />
                    </span>
                    <div className="tools">
                      <button className="icon-btn sm" onClick={(e) => (e.stopPropagation(), move(i, i - 1))} aria-label="Subir">
                        <ArrowUp />
                      </button>
                      <button className="icon-btn sm" onClick={(e) => (e.stopPropagation(), move(i, i + 1))} aria-label="Bajar">
                        <ArrowDown />
                      </button>
                      <button
                        className="icon-btn sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          const c = { ...f, id: newField(f.type).id, label: `${f.label} (copia)` };
                          const fs = [...fields];
                          fs.splice(i + 1, 0, c);
                          updateFields(fs);
                        }}
                        aria-label="Duplicar"
                      >
                        <Copy />
                      </button>
                      <button
                        className="icon-btn sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateFields(fields.filter((x) => x.id !== f.id));
                          if (sel === f.id) setSel(null);
                        }}
                        aria-label="Eliminar"
                      >
                        <Trash2 />
                      </button>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <TI.icon size={15} className="faint" />
                      <b className={f.type === 'section' ? 'section-title' : 'small'} style={f.type === 'section' ? { border: 0, padding: 0 } : undefined}>
                        {f.label}
                        {f.required && <span style={{ color: 'var(--t-red)' }}> *</span>}
                      </b>
                    </div>
                    <div className="xs faint" style={{ marginTop: 4 }}>
                      {TI.label}
                      {f.options?.length ? ` · ${f.options.length} opciones` : ''}
                      {f.help ? ` · ${f.help}` : ''}
                    </div>
                  </div>
                );
              })}
            </div>
            <div
              className={`canvas-drop ${dropNew ? 'drag' : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDropNew(true);
              }}
              onDragLeave={() => setDropNew(false)}
              onDrop={(e) => onDropCanvas(e, fields.length)}
            >
              <Plus size={18} style={{ verticalAlign: '-4px' }} /> Suelta aquí un campo o haz clic en la paleta
            </div>
          </div>

          <div className="card props">
            {selected ? (
              <FieldProps field={selected} onChange={(p) => patchField(selected.id, p)} onClose={() => setSel(null)} />
            ) : (
              <Empty title="Selecciona un campo" text="Haz clic en un campo del formulario para editar su etiqueta, ayuda, opciones y si es obligatorio." icon={<Pencil />} />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function FieldProps({ field, onChange, onClose }: { field: FormField; onChange: (p: Partial<FormField>) => void; onClose: () => void }) {
  const hasOptions = ['select', 'radio', 'checkbox'].includes(field.type);
  const opts = field.options || [];
  return (
    <div className="stack">
      <div className="row between">
        <h3 style={{ fontSize: 16 }}>Propiedades</h3>
        <button className="icon-btn sm" onClick={onClose} aria-label="Cerrar">
          <X />
        </button>
      </div>
      <span className="badge tone-violet" style={{ alignSelf: 'flex-start' }}>
        {typeInfo(field.type).label}
      </span>
      <div className="field">
        <label>{field.type === 'section' ? 'Título' : 'Pregunta / etiqueta'}</label>
        <input className="input" value={field.label} onChange={(e) => onChange({ label: e.target.value })} />
      </div>
      {field.type !== 'section' && !hasOptions && field.type !== 'file' && field.type !== 'date' && (
        <div className="field">
          <label>Texto de ejemplo</label>
          <input className="input" value={field.placeholder || ''} onChange={(e) => onChange({ placeholder: e.target.value })} />
        </div>
      )}
      <div className="field">
        <label>Ayuda (opcional)</label>
        <input className="input" value={field.help || ''} onChange={(e) => onChange({ help: e.target.value })} placeholder="Indicaciones para diligenciar" />
      </div>
      {hasOptions && (
        <div className="field">
          <label>Opciones</label>
          <div className="stack" style={{ gap: 6 }}>
            {opts.map((o, i) => (
              <div className="opt-row" key={i}>
                <input className="input" value={o} onChange={(e) => onChange({ options: opts.map((x, j) => (j === i ? e.target.value : x)) })} />
                <button className="icon-btn sm" onClick={() => onChange({ options: opts.filter((_, j) => j !== i) })} disabled={opts.length <= 1} aria-label="Quitar opción">
                  <Trash2 />
                </button>
              </div>
            ))}
            <button className="btn sm ghost" onClick={() => onChange({ options: [...opts, `Opción ${opts.length + 1}`] })}>
              <Plus /> Agregar opción
            </button>
          </div>
        </div>
      )}
      {field.type !== 'section' && (
        <>
          <Switch on={!!field.required} onChange={(v) => onChange({ required: v })} label="Obligatorio" />
          <div className="field">
            <label>Ancho</label>
            <div className="tabs">
              <button className={field.width !== 'half' ? 'on' : ''} onClick={() => onChange({ width: 'full' })}>
                Completo
              </button>
              <button className={field.width === 'half' ? 'on' : ''} onClick={() => onChange({ width: 'half' })}>
                Mitad
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
