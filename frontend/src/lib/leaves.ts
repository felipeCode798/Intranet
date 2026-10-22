import type { LeaveStatus, LeaveType } from './types';

export const LEAVE_TYPES: { key: LeaveType; label: string; hint: string }[] = [
  { key: 'PERSONAL', label: 'Personal', hint: 'Trámites o asuntos personales' },
  { key: 'MEDICAL', label: 'Médico (incapacidad)', hint: 'Debes adjuntar los documentos de la incapacidad' },
  { key: 'STUDY', label: 'Estudio', hint: 'Clases, exámenes o actividades académicas' },
  { key: 'VACATION', label: 'Vacaciones', hint: 'Días de vacaciones' },
  { key: 'ILLNESS', label: 'Enfermedad', hint: 'Malestar o enfermedad sin incapacidad' },
  { key: 'OTHER', label: 'Otros', hint: 'Cualquier otro motivo' },
];

export const LEAVE_LABEL = Object.fromEntries(LEAVE_TYPES.map((t) => [t.key, t.label])) as Record<LeaveType, string>;

export const LEAVE_STATUS: Record<LeaveStatus, { label: string; tone: string }> = {
  PENDING: { label: 'Pendiente', tone: 'amber' },
  APPROVED: { label: 'Aprobado', tone: 'green' },
  REJECTED: { label: 'Rechazado', tone: 'red' },
  CANCELLED: { label: 'Cancelado', tone: 'gray' },
};
