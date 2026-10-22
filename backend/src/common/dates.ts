import { BadRequestException } from '@nestjs/common';

/** Colombia no tiene horario de verano: UTC-5 todo el año */
const BOGOTA_OFFSET_MS = -5 * 3600000;

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Fecha de hoy en Bogotá como YYYY-MM-DD */
export const todayBogota = (now = new Date()) => new Date(now.getTime() + BOGOTA_OFFSET_MS).toISOString().slice(0, 10);

/** YYYY-MM-DD → Date a medianoche UTC (columnas @db.Date) */
export function dateOnly(s: string): Date {
  if (!DATE_RE.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) throw new BadRequestException(`Fecha inválida: ${s}`);
  return new Date(`${s}T00:00:00.000Z`);
}

export const fmtDay = (d: Date) => d.toISOString().slice(0, 10);

export const addDays = (s: string, n: number) => fmtDay(new Date(dateOnly(s).getTime() + n * 86400000));

/** Momento exacto (Date) de una fecha + hora HH:mm en Bogotá */
export const atBogota = (day: string, time: string) => new Date(`${day}T${time}:00-05:00`);

export const minutesBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 60000);

/** Un turno que termina antes (o a la misma hora) de la que empieza cruza la medianoche */
export const crossesMidnight = (start: string, end: string) => end <= start;

export const fmtLongDate = (s: string) =>
  new Date(`${s}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
