import type { Priority, RequestStatus } from './types';

export const STATUS: Record<RequestStatus, { label: string; tone: string }> = {
  PENDING_ASSIGNMENT: { label: 'Por asignar', tone: 'violet' },
  ASSIGNED: { label: 'Por aceptar', tone: 'blue' },
  IN_PROGRESS: { label: 'En gestión', tone: 'teal' },
  ESCALATION_REQUESTED: { label: 'Escalamiento', tone: 'amber' },
  RESOLVED: { label: 'Respondida', tone: 'green' },
  CANCELLED: { label: 'Anulada', tone: 'gray' },
};

export const PRIORITY: Record<Priority, { label: string; tone: string }> = {
  LOW: { label: 'Baja', tone: 'gray' },
  MEDIUM: { label: 'Media', tone: 'blue' },
  HIGH: { label: 'Alta', tone: 'rose' },
  URGENT: { label: 'Urgente', tone: 'red' },
};

export const EVENT_LABEL: Record<string, string> = {
  CREATED: 'Solicitud radicada',
  ASSIGNED: 'Asignada',
  ACCEPTED: 'Aceptada',
  ESCALATION_REQUESTED: 'Escalamiento solicitado',
  ESCALATION_REJECTED: 'Escalamiento no aprobado',
  REASSIGNED: 'Reasignada',
  TRANSFERRED: 'Trasladada a otra área',
  RESPONDED: 'Respondida',
  COMMENTED: 'Comentario',
  DUE_SOON_ALERT: 'Alerta: por vencer',
  OVERDUE_ALERT: 'Alerta: vencida',
  CANCELLED: 'Anulada',
};

const TZ = 'America/Bogota';
export const fmtDate = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ }) : '—';
export const fmtDateTime = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '—';
export const fmtTime = (d?: string | Date | null) =>
  d ? new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '';

/** "Vence en 2 d 4 h" / "Vencida hace 3 d" */
export function remaining(ms: number) {
  const abs = Math.abs(ms);
  const d = Math.floor(abs / 86400000);
  const h = Math.floor((abs % 86400000) / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const txt = d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
  return ms >= 0 ? `Vence en ${txt}` : `Vencida hace ${txt}`;
}

export const hoursLabel = (h: number) => (h >= 48 ? `${Math.round((h / 24) * 10) / 10} d` : `${Math.round(h * 10) / 10} h`);

export const initials = (name?: string | null) =>
  (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0])
    .join('')
    .toUpperCase();

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export const fileSize = (n?: number) => (!n ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

export const DOC_CATEGORIES: Record<string, string> = {
  formatos: 'Formatos',
  procedimientos: 'Procedimientos',
  politicas: 'Políticas',
  registros: 'Registros',
  manuales: 'Manuales',
  instructivos: 'Instructivos',
  documentos: 'Documentos',
};
