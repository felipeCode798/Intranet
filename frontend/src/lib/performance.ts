import { addDays, todayYmd } from './schedule';
import type { KpiDirection, KpiPeriod, KpiStatus } from './types';

export const DIRECTION_LABEL: Record<KpiDirection, string> = {
  HIGHER_BETTER: 'Entre más alto, mejor',
  LOWER_BETTER: 'Entre más bajo, mejor',
};

export const PERIOD_LABEL: Record<KpiPeriod, string> = { DAILY: 'Diario', WEEKLY: 'Semanal', MONTHLY: 'Mensual' };

export const STATUS_INFO: Record<KpiStatus, { label: string; tone: string }> = {
  MET: { label: 'Cumple', tone: 'tone-green' },
  NEAR: { label: 'Cerca', tone: 'tone-amber' },
  BELOW: { label: 'Por debajo', tone: 'tone-red' },
  NONE: { label: 'Sin medir', tone: 'tone-gray' },
};

/** 90 → "1 h 30 min" */
export function fmtMinutes(m: number) {
  if (!m) return '—';
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h ? `${h} h${r ? ` ${r} min` : ''}` : `${r} min`;
}

export const fmtPct = (v: number | null | undefined) => (v === null || v === undefined ? '—' : `${Math.round(v * 100)} %`);

/** Valor de un KPI con su unidad: 92,5 % · 12 tickets */
export function fmtValue(v: number | null | undefined, unit: string) {
  if (v === null || v === undefined) return '—';
  const n = Number.isInteger(v) ? String(v) : v.toLocaleString('es-CO', { maximumFractionDigits: 2 });
  return unit === '%' ? `${n} %` : unit ? `${n} ${unit}` : n;
}

export const monthRange = (day = todayYmd()) => {
  const first = `${day.slice(0, 7)}-01`;
  const d = new Date(`${first}T00:00:00Z`);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  return { from: first, to: last };
};

/** Mes anterior (-1) o siguiente (+1) al que contiene `from` */
export const shiftMonth = (from: string, delta: number) => monthRange(addDays(from, delta < 0 ? -1 : 32));

export const monthLabel = (from: string) => new Date(`${from}T12:00:00Z`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Cómo se guarda una medición según la frecuencia del KPI */
export function periodText(period: KpiPeriod, day: string) {
  const d = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (period === 'DAILY') return `el ${d(day)}`;
  if (period === 'MONTHLY') return `${monthLabel(day)}`;
  const monday = addDays(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7));
  return `la semana del ${d(monday)} al ${d(addDays(monday, 6))}`;
}

/** Fila de la medición según el periodo del KPI */
export function measureLabel(period: KpiPeriod, start: string) {
  const d = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  if (period === 'DAILY') return d(start);
  if (period === 'MONTHLY') return new Date(`${start}T12:00:00Z`).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return `Sem. ${d(start)}`;
}

/** Color del cumplimiento (0–1+) */
export const scoreColor = (s: number | null) => (s === null ? 'var(--ink-3)' : s >= 1 ? 'var(--t-green, #16a34a)' : s >= 0.8 ? 'var(--t-amber, #d97706)' : 'var(--critical)');
