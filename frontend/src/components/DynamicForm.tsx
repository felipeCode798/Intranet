import type { FileValue, FormField } from '../lib/types';
import { AttachmentList, FileUpload } from './FileUpload';

type Values = Record<string, any>;

const isEmpty = (v: any) => v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length);

/** Devuelve el primer error de validación (mismas reglas que el backend) */
export function validateForm(fields: FormField[], values: Values): Record<string, string> {
  const errs: Record<string, string> = {};
  for (const f of fields) {
    if (f.type === 'section') continue;
    const v = values[f.id];
    if (f.required && isEmpty(v)) errs[f.id] = 'Este campo es obligatorio';
    else if (!isEmpty(v) && f.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errs[f.id] = 'Correo inválido';
    else if (!isEmpty(v) && f.type === 'number' && Number.isNaN(Number(v))) errs[f.id] = 'Debe ser un número';
  }
  return errs;
}

export function DynamicForm({
  fields,
  values,
  onChange,
  errors = {},
  disabled,
}: {
  fields: FormField[];
  values: Values;
  onChange: (v: Values) => void;
  errors?: Record<string, string>;
  disabled?: boolean;
}) {
  const set = (id: string, v: any) => onChange({ ...values, [id]: v });
  if (!fields.length) return <div className="empty small">Este formulario aún no tiene campos.</div>;

  return (
    <div className="form-grid">
      {fields.map((f) => {
        if (f.type === 'section')
          return (
            <div key={f.id} className="full section-title">
              {f.label}
              {f.help && <div className="xs faint" style={{ fontWeight: 400 }}>{f.help}</div>}
            </div>
          );
        const v = values[f.id];
        const id = `fld-${f.id}`;
        return (
          <div key={f.id} className={`field ${f.width === 'half' ? '' : 'full'}`}>
            <label htmlFor={id}>
              {f.label}
              {f.required && <span className="req">*</span>}
            </label>
            {f.type === 'textarea' ? (
              <textarea id={id} className="textarea" placeholder={f.placeholder} value={v || ''} onChange={(e) => set(f.id, e.target.value)} disabled={disabled} />
            ) : f.type === 'select' ? (
              <select id={id} className="select" value={v || ''} onChange={(e) => set(f.id, e.target.value)} disabled={disabled}>
                <option value="">{f.placeholder || 'Selecciona una opción'}</option>
                {f.options?.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </select>
            ) : f.type === 'radio' ? (
              <div className="options-grid" role="radiogroup">
                {f.options?.map((o) => (
                  <label key={o} className={`opt-pill ${v === o ? 'on' : ''}`}>
                    <input type="radio" name={id} checked={v === o} onChange={() => set(f.id, o)} disabled={disabled} />
                    {o}
                  </label>
                ))}
              </div>
            ) : f.type === 'checkbox' ? (
              <div className="options-grid">
                {f.options?.map((o) => {
                  const arr: string[] = Array.isArray(v) ? v : [];
                  const on = arr.includes(o);
                  return (
                    <label key={o} className={`opt-pill ${on ? 'on' : ''}`}>
                      <input type="checkbox" checked={on} onChange={() => set(f.id, on ? arr.filter((x) => x !== o) : [...arr, o])} disabled={disabled} />
                      {o}
                    </label>
                  );
                })}
              </div>
            ) : f.type === 'file' ? (
              <FileUpload value={(v as FileValue[]) || []} onChange={(x) => set(f.id, x)} disabled={disabled} />
            ) : (
              <input
                id={id}
                className="input"
                type={f.type === 'number' ? 'number' : f.type === 'email' ? 'email' : f.type === 'date' ? 'date' : 'text'}
                placeholder={f.placeholder}
                value={v ?? ''}
                onChange={(e) => set(f.id, e.target.value)}
                disabled={disabled}
              />
            )}
            {f.help && <span className="help">{f.help}</span>}
            {errors[f.id] && <span className="err">{errors[f.id]}</span>}
          </div>
        );
      })}
    </div>
  );
}

/** Muestra los datos diligenciados de una solicitud */
export function DataView({ fields, data }: { fields: FormField[]; data: Values }) {
  return (
    <dl className="data-list">
      {fields.map((f) => {
        if (f.type === 'section') return <h4 key={f.id}>{f.label}</h4>;
        const v = data?.[f.id];
        let content: React.ReactNode = <span className="faint">—</span>;
        if (f.type === 'file') content = Array.isArray(v) && v.length ? <AttachmentList files={v} /> : content;
        else if (Array.isArray(v)) content = v.length ? v.join(', ') : content;
        else if (f.type === 'number' && v !== undefined && v !== '') content = Number(v).toLocaleString('es-CO');
        else if (f.type === 'date' && v) content = new Date(`${v}T12:00:00`).toLocaleDateString('es-CO', { dateStyle: 'long' });
        else if (v !== undefined && v !== null && v !== '') content = String(v);
        return (
          <div key={f.id} className={f.type === 'textarea' || f.type === 'file' || f.width !== 'half' ? 'full' : ''}>
            <dt>{f.label}</dt>
            <dd>{content}</dd>
          </div>
        );
      })}
    </dl>
  );
}
