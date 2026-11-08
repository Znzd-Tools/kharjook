import { addDays, formatJalaali, type JalaaliDate } from '@/shared/utils/jalali';

interface Dated {
  due: string;
}

/**
 * Count items that are overdue or due within `days` days (inclusive).
 * Jalali strings are canonical `YYYY/MM/DD`, so string order = date order.
 */
export function countDueSoon(items: Dated[], today: JalaaliDate, days = 7): number {
  const limit = formatJalaali(addDays(today, days));
  return items.filter((i) => i.due <= limit).length;
}
