import {
  formatJalaali,
  formatJalaaliHuman,
  parseJalaali,
  todayJalaaliInTimezone,
  type JalaaliDate,
} from '@/shared/utils/jalali';
import { compareJalaaliStrings, daysBetweenJalaali } from '@/features/notifications/utils/jalali-days';
import {
  formatTelegramMoney,
  TELEGRAM_SEPARATOR,
  toPersianDigits,
} from '@/features/notifications/telegram/utils/format-helpers';
import type { TelegramInlineMarkup } from '@/features/notifications/telegram/utils/telegram-client';

export const TEHRAN_TIMEZONE = 'Asia/Tehran';

export type DebtListItem = {
  installmentId: string;
  loanId: string;
  loanTitle: string;
  dueDateString: string;
  amountToman: number;
  daysUntilDue: number;
  reminderDaysBefore: number[];
};

export type CheckListItem = {
  checkId: string;
  title: string;
  dueDateString: string;
  amountToman: number;
  daysUntilDue: number;
  bankName?: string | null;
};

export type SubscriptionListItem = {
  subscriptionId: string;
  platform: string;
  dueDateString: string;
  amountToman: number;
  daysUntilDue: number;
  reminderDaysBefore: number[];
};

export type DebtsListScope = 'today' | 'month' | 'overdue' | 'all' | 'advance';

function dueLabel(daysUntilDue: number): string {
  if (daysUntilDue < 0) return `${toPersianDigits(Math.abs(daysUntilDue))} روز گذشته`;
  if (daysUntilDue === 0) return 'امروز';
  if (daysUntilDue === 1) return 'فردا';
  return `${toPersianDigits(daysUntilDue)} روز دیگر`;
}

export function installmentDaysUntilDue(
  dueDateString: string,
  today: JalaaliDate = todayJalaaliInTimezone(TEHRAN_TIMEZONE)
): number | null {
  const todayStr = formatJalaali(today);
  return daysBetweenJalaali(todayStr, dueDateString);
}

export function formatDebtsListMessage(
  items: DebtListItem[],
  scope: DebtsListScope = 'all',
  checks: CheckListItem[] = [],
  subscriptions: SubscriptionListItem[] = []
): string {
  const today = todayJalaaliInTimezone(TEHRAN_TIMEZONE);
  const todayLine = toPersianDigits(formatJalaaliHuman(today));
  const heading =
    scope === 'today'
      ? '⏰ سررسید امروز'
      : scope === 'advance'
        ? '📣 یادآوری سررسید'
        : scope === 'month'
          ? '📅 اقساط، چک‌ها و اشتراک‌های این ماه'
          : scope === 'overdue'
            ? '🔴 معوقات'
            : '📋 بدهی‌ها، اقساط، چک‌ها و اشتراک‌ها';

  if (items.length === 0 && checks.length === 0 && subscriptions.length === 0) {
    const emptyLine =
      scope === 'today'
        ? '✅ امروز قسط، چک یا اشتراکی سررسید ندارید.'
        : scope === 'advance'
          ? '✅ یادآوری سررسیدی برای امروز ندارید.'
          : scope === 'month'
            ? '✅ قسط، چک یا اشتراک پرداخت‌نشده‌ای در این ماه ندارید.'
            : scope === 'overdue'
              ? '✅ قسط، چک یا اشتراک معوقی ندارید.'
              : '✅ قسط، چک یا اشتراک پرداخت‌نشده‌ای ندارید.';
    return `${heading}\n${TELEGRAM_SEPARATOR}\n📅 ${todayLine}\n\n${emptyLine}\n${TELEGRAM_SEPARATOR}`;
  }

  const sorted = [...items].sort((a, b) =>
    compareJalaaliStrings(a.dueDateString, b.dueDateString)
  );
  const sortedChecks = [...checks].sort((a, b) =>
    compareJalaaliStrings(a.dueDateString, b.dueDateString)
  );
  const sortedSubscriptions = [...subscriptions].sort((a, b) =>
    compareJalaaliStrings(a.dueDateString, b.dueDateString)
  );

  const lines: string[] = [heading, TELEGRAM_SEPARATOR, `📅 ${todayLine}`, ''];

  if (scope === 'today') {
    const total =
      sorted.reduce((sum, item) => sum + item.amountToman, 0) +
      sortedChecks.reduce((sum, item) => sum + item.amountToman, 0) +
      sortedSubscriptions.reduce((sum, item) => sum + item.amountToman, 0);
    const count = sorted.length + sortedChecks.length + sortedSubscriptions.length;
    lines.push(`🟠 ${toPersianDigits(count)} مورد · ${formatTelegramMoney(total, 'TOMAN')}`);
    lines.push('');
  }

  if (scope === 'month' || scope === 'overdue') {
    const total =
      sorted.reduce((sum, item) => sum + item.amountToman, 0) +
      sortedChecks.reduce((sum, item) => sum + item.amountToman, 0) +
      sortedSubscriptions.reduce((sum, item) => sum + item.amountToman, 0);
    const count = sorted.length + sortedChecks.length + sortedSubscriptions.length;
    lines.push(`📌 ${toPersianDigits(count)} مورد · ${formatTelegramMoney(total, 'TOMAN')}`);
    lines.push('');
  }

  for (const item of sorted) {
    const due = parseJalaali(item.dueDateString);
    const dueHuman = due
      ? toPersianDigits(formatJalaaliHuman(due))
      : toPersianDigits(item.dueDateString);
    const icon = item.daysUntilDue < 0 ? '🔴' : item.daysUntilDue === 0 ? '🟠' : '📌';
    lines.push(`${icon} ${item.loanTitle}`);
    lines.push(`   📅 ${dueHuman} · ${dueLabel(item.daysUntilDue)}`);
    lines.push(`   💰 ${formatTelegramMoney(item.amountToman, 'TOMAN')}`);
    lines.push('');
  }

  for (const item of sortedChecks) {
    const due = parseJalaali(item.dueDateString);
    const dueHuman = due
      ? toPersianDigits(formatJalaaliHuman(due))
      : toPersianDigits(item.dueDateString);
    const icon = item.daysUntilDue < 0 ? '🔴' : item.daysUntilDue === 0 ? '🟠' : '📌';
    const bankSuffix = item.bankName ? ` · ${item.bankName}` : '';
    lines.push(`${icon} 🧾 ${item.title}${bankSuffix}`);
    lines.push(`   📅 ${dueHuman} · ${dueLabel(item.daysUntilDue)}`);
    lines.push(`   💰 ${formatTelegramMoney(item.amountToman, 'TOMAN')}`);
    lines.push('');
  }

  for (const item of sortedSubscriptions) {
    const due = parseJalaali(item.dueDateString);
    const dueHuman = due
      ? toPersianDigits(formatJalaaliHuman(due))
      : toPersianDigits(item.dueDateString);
    const icon = item.daysUntilDue < 0 ? '🔴' : item.daysUntilDue === 0 ? '🟠' : '📌';
    lines.push(`${icon} 🔁 ${item.platform}`);
    lines.push(`   📅 ${dueHuman} · ${dueLabel(item.daysUntilDue)}`);
    lines.push(`   💰 ${formatTelegramMoney(item.amountToman, 'TOMAN')}`);
    lines.push('');
  }

  lines.push(TELEGRAM_SEPARATOR);
  return lines.join('\n').trim();
}

function truncateLabel(text: string, max = 28): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function buildInstallmentPayInlineKeyboard(items: DebtListItem[]): TelegramInlineMarkup | null {
  const payable = items.filter((item) => item.installmentId).slice(0, 8);
  if (payable.length === 0) return null;

  const rows = payable.map((item) => [
    {
      text: `✅ ${truncateLabel(item.loanTitle)}`,
      callback_data: `pi:${item.installmentId}`,
    },
  ]);

  return { inline_keyboard: rows };
}
