import { jalaaliMonthLength } from '@/shared/utils/jalali';
import { shiftPeriod, type Period } from '@/shared/utils/period';

/** Same calendar slice in the prior month/year (e.g. day 1–15 vs 1–15). */
export function matchingPriorPeriod(period: Period): Period | null {
  if (period.kind === 'all' || period.kind === 'day' || period.kind === 'week') {
    return null;
  }

  if (period.kind === 'month') {
    const prevStart = shiftPeriod(period, -1).start;
    const endDay = Math.min(period.end.jd, jalaaliMonthLength(prevStart.jy, prevStart.jm));
    return {
      kind: 'month',
      start: prevStart,
      end: { jy: prevStart.jy, jm: prevStart.jm, jd: endDay },
    };
  }

  const prevYear = period.start.jy - 1;
  const endDay = Math.min(
    period.end.jd,
    jalaaliMonthLength(prevYear, period.end.jm)
  );
  return {
    kind: 'year',
    start: { jy: prevYear, jm: 1, jd: 1 },
    end: { jy: prevYear, jm: period.end.jm, jd: endDay },
  };
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    if (current === 0) return 0;
    return null;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function priorPeriodCompareLabel(kind: Period['kind']): string {
  if (kind === 'month') return 'نسبت به ماه قبل (هم‌تراز)';
  if (kind === 'year') return 'نسبت به سال قبل (هم‌تراز)';
  return '';
}

export type CompareMetric = {
  key: string;
  label: string;
  current: number;
  previous: number;
  deltaPct: number | null;
  /** When true, a positive delta is favorable (income, net, profit). */
  higherIsBetter: boolean;
};
