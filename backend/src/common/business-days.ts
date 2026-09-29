/**
 * Suma días hábiles (lunes a viernes) a una fecha, conservando la hora.
 * Nota: no contempla festivos; ver README para integrarlos.
 */
export function addBusinessDays(start: Date, days: number): Date {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return d;
}

export const OPEN_STATUSES = [
  'PENDING_ASSIGNMENT',
  'ASSIGNED',
  'IN_PROGRESS',
  'ESCALATION_REQUESTED',
] as const;

export const formatCode = (seq: number) => `SOL-${String(seq).padStart(5, '0')}`;

export const STATUS_LABEL: Record<string, string> = {
  PENDING_ASSIGNMENT: 'Pendiente de asignación',
  ASSIGNED: 'Asignada · por aceptar',
  IN_PROGRESS: 'En gestión',
  ESCALATION_REQUESTED: 'Escalamiento solicitado',
  RESOLVED: 'Respondida',
  CANCELLED: 'Anulada',
};

export const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  URGENT: 'Urgente',
};
