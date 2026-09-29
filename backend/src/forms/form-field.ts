import { BadRequestException } from '@nestjs/common';

export const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'email',
  'date',
  'select',
  'radio',
  'checkbox',
  'file',
  'section',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  help?: string;
  required?: boolean;
  options?: string[];
  width?: 'full' | 'half';
}

export interface FileValue {
  fileName: string;
  url: string;
  mimeType?: string;
  size?: number;
}

/** Normaliza y valida la definición de campos que envía el constructor de formularios */
export function sanitizeFields(raw: unknown): FormField[] {
  if (!Array.isArray(raw)) throw new BadRequestException('Los campos deben ser una lista');
  const ids = new Set<string>();
  return raw.map((f: any, i) => {
    const type = FIELD_TYPES.includes(f?.type) ? f.type : null;
    if (!type) throw new BadRequestException(`El campo #${i + 1} tiene un tipo inválido`);
    const label = String(f.label || '').trim();
    if (!label) throw new BadRequestException(`El campo #${i + 1} necesita una etiqueta`);
    let id = String(f.id || '').trim() || `campo_${i + 1}`;
    while (ids.has(id)) id = `${id}_${i}`;
    ids.add(id);
    const needsOptions = ['select', 'radio', 'checkbox'].includes(type);
    const options = needsOptions
      ? (Array.isArray(f.options) ? f.options : []).map((o: any) => String(o).trim()).filter(Boolean)
      : undefined;
    if (needsOptions && !options!.length) throw new BadRequestException(`"${label}" necesita al menos una opción`);
    return {
      id,
      type,
      label,
      placeholder: f.placeholder ? String(f.placeholder) : undefined,
      help: f.help ? String(f.help) : undefined,
      required: type === 'section' ? false : !!f.required,
      options,
      width: f.width === 'half' ? 'half' : 'full',
    };
  });
}

const isEmpty = (v: unknown) =>
  v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);

/** Valida los datos de una solicitud contra los campos del formulario y descarta claves desconocidas */
export function validateData(fields: FormField[], data: Record<string, unknown>) {
  const clean: Record<string, unknown> = {};
  const files: FileValue[] = [];
  for (const f of fields) {
    if (f.type === 'section') continue;
    const v = data?.[f.id];
    if (f.required && isEmpty(v)) throw new BadRequestException(`El campo "${f.label}" es obligatorio`);
    if (isEmpty(v)) continue;
    switch (f.type) {
      case 'number':
        if (Number.isNaN(Number(v))) throw new BadRequestException(`"${f.label}" debe ser un número`);
        clean[f.id] = Number(v);
        break;
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v))) throw new BadRequestException(`"${f.label}" debe ser un correo válido`);
        clean[f.id] = String(v);
        break;
      case 'select':
      case 'radio':
        if (f.options && !f.options.includes(String(v))) throw new BadRequestException(`Opción inválida en "${f.label}"`);
        clean[f.id] = String(v);
        break;
      case 'checkbox': {
        const arr = (Array.isArray(v) ? v : [v]).map(String).filter((o) => !f.options || f.options.includes(o));
        clean[f.id] = arr;
        break;
      }
      case 'file': {
        const arr = (Array.isArray(v) ? v : [v])
          .filter((x: any) => x && typeof x.url === 'string' && x.url.startsWith('/uploads/'))
          .map((x: any) => ({ fileName: String(x.fileName || 'archivo'), url: x.url, mimeType: x.mimeType, size: Number(x.size) || 0 }));
        if (f.required && !arr.length) throw new BadRequestException(`El campo "${f.label}" es obligatorio`);
        clean[f.id] = arr;
        files.push(...arr);
        break;
      }
      default:
        clean[f.id] = String(v).slice(0, 10000);
    }
  }
  return { clean, files };
}
