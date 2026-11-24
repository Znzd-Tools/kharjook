/**
 * Points for the Home hero trend chart, from the daily portfolio snapshots.
 * Pure, tested.
 */
import { JALALI_MONTHS } from '@/shared/utils/jalali';

export type TrendRange = '1m' | '3m' | '1y';

export interface TrendRow {
  date_string: string;
  total_toman: number;
  total_usd: number;
}

export interface TrendPoint {
  key: string;
  label: string;
  value: number;
}

const DAYS: Record<TrendRange, number> = { '1m': 31, '3m': 92, '1y': 366 };
/** Max points drawn: keeps the line smooth and the touch target wide. */
const MAX_POINTS = 60;

const fa = (s: string) => s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);
export const dayLabel = (d: string) => {
  const [, m, day] = d.split('/').map(Number) as [number, number, number];
  return `${fa(String(day))} ${JALALI_MONTHS[m - 1] ?? ''}`;
};

/**
 * Last `range` of snapshots (oldest first), thinned to at most 60 points,
 * in Toman or USD. The live value replaces today's snapshot so the line
 * ends at the number on the hero card. `fromDate` = first day in range.
 */
export function heroTrend(rows: TrendRow[], range: TrendRange, unit: 'TOMAN' | 'USD', live: { date: string; toman: number; usd: number }, fromDate: string): TrendPoint[] {
  const pick = (r: { toman: number; usd: number }) => (unit === 'USD' ? r.usd : r.toman);
  const inRange = rows.filter((r) => r.date_string >= fromDate && r.date_string < live.date);
  const step = Math.max(1, Math.ceil(inRange.length / (MAX_POINTS - 1)));
  // Keep the newest of every `step` rows (counting back from the end).
  const kept = inRange.filter((_, i) => (inRange.length - 1 - i) % step === 0);
  const points = kept.map((r) => ({ key: r.date_string, label: dayLabel(r.date_string), value: pick({ toman: Number(r.total_toman), usd: Number(r.total_usd) }) }));
  points.push({ key: live.date, label: 'امروز', value: pick(live) });
  return points;
}

/** Change from the first to the last point, in percent; null if no base. */
export function trendChangePct(points: TrendPoint[]): number | null {
  if (points.length < 2) return null;
  const a = points[0]!.value;
  const b = points.at(-1)!.value;
  return a > 0 ? ((b - a) / a) * 100 : null;
}

export const RANGE_DAYS = DAYS;
