import { JALALI_MONTHS } from '@/shared/utils/jalali';

/** "1405/09" → "آذر ۱۴۰۵". */
export function monthLabel(prefix: string): string {
  const [y, m] = prefix.split('/').map(Number);
  return `${JALALI_MONTHS[(m ?? 1) - 1]} ${(y ?? 0).toLocaleString('fa-IR', { useGrouping: false })}`;
}

/** Add months to a "YYYY/MM" prefix. */
export function addMonthPrefix(prefix: string, add: number): string {
  const [y, m] = prefix.split('/').map(Number);
  const total = (m! - 1) + add;
  return `${y! + Math.floor(total / 12)}/${String(((total % 12) + 12) % 12 + 1).padStart(2, '0')}`;
}
