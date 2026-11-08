import type { LoanIntervalPeriod, Subscription } from '@/shared/types/domain';
import { nthIntervalDate } from '@/features/deadlines/utils/schedule';
import { compareJalaaliStrings } from '@/features/notifications/utils/jalali-days';
import { formatJalaali, parseJalaali } from '@/shared/utils/jalali';
import { isInPeriod, type Period } from '@/shared/utils/period';

type DueDatesAnchor = {
  dateString: string;
  intervalNumber: number;
  intervalPeriod: LoanIntervalPeriod;
  endDateString?: string | null;
};

function dueDatesInPeriod(anchor: DueDatesAnchor, period: Period): string[] {
  const parsedAnchor = parseJalaali(anchor.dateString);
  if (!parsedAnchor) return [];

  // Every date is computed from the anchor (anchor + i × interval) so
  // month-end days do not drift after a short month.
  const at = (i: number) =>
    formatJalaali(
      nthIntervalDate(parsedAnchor, anchor.intervalNumber, anchor.intervalPeriod, i)
    );

  const periodStart = formatJalaali(period.start);
  const periodEnd = formatJalaali(period.end);
  let index = 0;
  while (index < 500 && compareJalaaliStrings(at(index), periodStart) < 0) {
    index += 1;
  }

  const dates: string[] = [];
  for (let i = 0; i < 500; i += 1, index += 1) {
    const dueStr = at(index);
    if (anchor.endDateString && compareJalaaliStrings(dueStr, anchor.endDateString) > 0) {
      break;
    }
    if (compareJalaaliStrings(dueStr, periodEnd) > 0) break;
    if (isInPeriod(dueStr, period)) dates.push(dueStr);
  }

  return dates;
}

/** All due-date strings for an active subscription that fall inside `period`. */
export function subscriptionDueDatesInPeriod(row: Subscription, period: Period): string[] {
  if (row.status !== 'active' || row.deleted_at) return [];
  return dueDatesInPeriod(
    {
      dateString: row.next_due_date_string,
      intervalNumber: row.interval_number,
      intervalPeriod: row.interval_period,
    },
    period
  );
}

/** «هر ماه» / «هر ۲ هفته» for a subscription or loan interval. */
export function intervalLabel(row: { interval_number: number; interval_period: LoanIntervalPeriod }): string {
  const n = row.interval_number;
  const unit = row.interval_period === 'day' ? 'روز' : row.interval_period === 'week' ? 'هفته' : row.interval_period === 'month' ? 'ماه' : 'سال';
  return n === 1 ? `هر ${unit}` : `هر ${n} ${unit}`;
}
