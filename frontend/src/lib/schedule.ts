import type { ScheduleEntry, ScheduleMode } from './types';

export const MODE_INFO: Record<ScheduleMode, { label: string; description: string }> = {
  FIXED: { label: 'Fijo', description: 'El mismo horario todos los días de trabajo de la semana.' },
  DAILY: { label: 'Cambia cada día', description: 'Cada día tiene su propio turno; se arma en la cuadrícula o con una plantilla de la semana.' },
  WEEKLY: { label: 'Cambia cada semana', description: 'Cada semana la persona trabaja un turno distinto (por ejemplo, mañana una semana y tarde la siguiente).' },
  ROTATING: { label: 'Rotativo', description: 'Una secuencia de turnos que se repite (por ejemplo 2 mañanas, 2 tardes, 2 noches y descanso).' },
};

export const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const WEEKDAYS_LONG = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

/** Fechas como texto YYYY-MM-DD para evitar problemas de zona horaria */
export const addDays = (s: string, n: number) => new Date(Date.parse(`${s}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const todayYmd = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
export const weekdayIdx = (s: string) => (new Date(`${s}T12:00:00Z`).getUTCDay() + 6) % 7; // 0 = lunes
export const mondayOf = (s: string) => addDays(s, -weekdayIdx(s));
export const diffDays = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000);
export const eachDay = (from: string, to: string) => {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
};
export const fmtDayShort = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
export const fmtDayLong = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
export const fmtDayFull = (s?: string | null) => (s ? new Date(`${s}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');

export const shiftLabel = (e?: Pick<ScheduleEntry, 'isRest' | 'startTime' | 'endTime'> | null) =>
  !e ? 'Sin horario' : e.isRest ? 'Descanso' : `${e.startTime} – ${e.endTime}`;

/** Un turno que termina antes de empezar cruza la medianoche */
export const crossesMidnight = (s?: string | null, e?: string | null) => !!s && !!e && e <= s;

// ---------------------------------------------------------------- generadores de patrones
/** Lo que el API recibe: un turno (o descanso) para una persona en un día */
export interface EntryInput {
  userId: string;
  date: string;
  templateId?: string;
  /** Horario sin turno predefinido */
  startTime?: string;
  endTime?: string;
  isRest?: boolean;
  clear?: boolean;
}

interface Base {
  userIds: string[];
  from: string;
  to: string;
}

/** Fijo: el mismo turno en los días elegidos; el resto, descanso (si el área tiene turno de descanso) */
export function fixedPattern(p: Base & { templateId: string; weekdays: number[]; restId?: string }): EntryInput[] {
  const out: EntryInput[] = [];
  for (const userId of p.userIds)
    for (const date of eachDay(p.from, p.to)) {
      if (p.weekdays.includes(weekdayIdx(date))) out.push({ userId, date, templateId: p.templateId });
      else if (p.restId) out.push({ userId, date, templateId: p.restId });
    }
  return out;
}

/** Cambia cada día: un turno por día de la semana, repetido en el rango */
export function dailyPattern(p: Base & { perWeekday: (string | '')[] }): EntryInput[] {
  const out: EntryInput[] = [];
  for (const userId of p.userIds)
    for (const date of eachDay(p.from, p.to)) {
      const templateId = p.perWeekday[weekdayIdx(date)];
      if (templateId) out.push({ userId, date, templateId });
    }
  return out;
}

/** Cambia cada semana: un turno por semana (la primera semana empieza en el lunes de `from`) */
export function weeklyPattern(p: Base & { perWeek: string[]; weekdays: number[]; restId?: string }): EntryInput[] {
  const out: EntryInput[] = [];
  const start = mondayOf(p.from);
  for (const userId of p.userIds)
    for (const date of eachDay(p.from, p.to)) {
      const week = Math.floor(diffDays(start, date) / 7);
      const templateId = p.perWeek[week];
      if (p.weekdays.includes(weekdayIdx(date)) && templateId) out.push({ userId, date, templateId });
      else if (p.restId) out.push({ userId, date, templateId: p.restId });
    }
  return out;
}

/** Rotativo: secuencia [{turno, días}] que se repite; `stagger` desfasa a cada persona N días respecto a la anterior */
export function rotatingPattern(p: Base & { steps: { templateId: string; days: number }[]; stagger: number }): EntryInput[] {
  const steps = p.steps.filter((s) => s.templateId && s.days > 0);
  const cycle = steps.reduce((n, s) => n + s.days, 0);
  if (!cycle) return [];
  const out: EntryInput[] = [];
  p.userIds.forEach((userId, i) => {
    for (const date of eachDay(p.from, p.to)) {
      let k = (diffDays(p.from, date) + i * p.stagger) % cycle;
      for (const s of steps) {
        if (k < s.days) {
          out.push({ userId, date, templateId: s.templateId });
          break;
        }
        k -= s.days;
      }
    }
  });
  return out;
}
