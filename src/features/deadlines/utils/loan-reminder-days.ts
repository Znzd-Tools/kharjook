export const LOAN_REMINDER_DAY_OPTIONS = [1, 3, 7, 14] as const;

export function normalizeReminderDaysBefore(values: number[]): number[] {
  return Array.from(
    new Set(values.filter((d) => Number.isInteger(d) && d > 0 && d <= 90))
  ).sort((a, b) => a - b);
}

export function reminderDaysLabel(days: number[]): string {
  const normalized = normalizeReminderDaysBefore(days);
  if (normalized.length === 0) return 'فقط روز سررسید';
  return normalized.map((d) => `${d} روز قبل`).join('، ');
}
