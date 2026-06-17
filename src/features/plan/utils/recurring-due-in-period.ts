import type { LoanIntervalPeriod, RecurringTransaction } from '@/shared/types/domain';
import { addIntervalDate } from '@/features/deadlines/utils/schedule';
import { compareJalaaliStrings } from '@/features/notifications/utils/jalali-days';
import {
  addDays,
  formatJalaali,
  jalaaliMonthLength,
  parseJalaali,
  type JalaaliDate,
} from '@/shared/utils/jalali';
import { isInPeriod, type Period } from '@/shared/utils/period';

function subtractIntervalDate(
  date: JalaaliDate,
  intervalNumber: number,
  intervalPeriod: LoanIntervalPeriod
): JalaaliDate {
  if (intervalPeriod === 'day') return addDays(date, -intervalNumber);
  if (intervalPeriod === 'week') return addDays(date, -intervalNumber * 7);
  if (intervalPeriod === 'month') {
    const absoluteMonth = date.jm - 1 - intervalNumber;
    const nextYear = date.jy + Math.floor(absoluteMonth / 12);
    const nextMonth = ((absoluteMonth % 12) + 12) % 12 + 1;
    const monthLength = jalaaliMonthLength(nextYear, nextMonth);
    return { jy: nextYear, jm: nextMonth, jd: Math.min(date.jd, monthLength) };
  }
  const nextYear = date.jy - intervalNumber;
  const monthLength = jalaaliMonthLength(nextYear, date.jm);
  return { jy: nextYear, jm: date.jm, jd: Math.min(date.jd, monthLength) };
}

/** All due-date strings for a recurring row that fall inside `period`. */
export function recurringDueDatesInPeriod(
  row: RecurringTransaction,
  period: Period
): string[] {
  if (!row.is_active || row.deleted_at) return [];

  const anchor = parseJalaali(row.next_due_date_string);
  if (!anchor) return [];

  const periodStart = formatJalaali(period.start);
  let cursor = anchor;
  for (let i = 0; i < 500; i += 1) {
    const cursorStr = formatJalaali(cursor);
    if (compareJalaaliStrings(cursorStr, periodStart) < 0) {
      cursor = addIntervalDate(cursor, row.interval_number, row.interval_period);
      continue;
    }
    break;
  }

  const dates: string[] = [];
  let dueStr = formatJalaali(cursor);
  for (let i = 0; i < 500; i += 1) {
    if (row.end_date_string && compareJalaaliStrings(dueStr, row.end_date_string) > 0) {
      break;
    }
    if (isInPeriod(dueStr, period)) {
      dates.push(dueStr);
    }
    if (compareJalaaliStrings(dueStr, formatJalaali(period.end)) > 0) {
      break;
    }
    const parsed = parseJalaali(dueStr);
    if (!parsed) break;
    dueStr = formatJalaali(
      addIntervalDate(parsed, row.interval_number, row.interval_period)
    );
  }

  return dates;
}

/** Walk backward from anchor until just before period start (for recurring scan). */
export function rewindRecurringAnchor(
  anchor: JalaaliDate,
  intervalNumber: number,
  intervalPeriod: LoanIntervalPeriod,
  periodStart: JalaaliDate
): JalaaliDate {
  const periodStartStr = formatJalaali(periodStart);
  let cursor = anchor;
  for (let i = 0; i < 500; i += 1) {
    const cursorStr = formatJalaali(cursor);
    if (compareJalaaliStrings(cursorStr, periodStartStr) < 0) {
      return cursor;
    }
    cursor = subtractIntervalDate(cursor, intervalNumber, intervalPeriod);
  }
  return cursor;
}
