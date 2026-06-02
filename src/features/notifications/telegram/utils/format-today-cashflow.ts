import type { CashflowSummary } from '@/features/notifications/utils/build-user-snapshot';
import { TEHRAN_TIMEZONE } from '@/features/notifications/telegram/utils/format-debts-list';
import {
  formatTelegramMoney,
  JALALI_WEEKDAY_NAMES,
  TELEGRAM_SEPARATOR,
  toPersianDigits,
} from '@/features/notifications/telegram/utils/format-helpers';
import {
  clampPeriodToToday,
  formatPeriodLabel,
  periodContaining,
} from '@/shared/utils/period';
import {
  formatJalaaliHuman,
  jalaaliWeekday,
  todayJalaaliInTimezone,
} from '@/shared/utils/jalali';

export type CashflowScope = 'day' | 'month';

function formatCashflowMessage(
  scope: CashflowScope,
  toman: CashflowSummary,
  usd: CashflowSummary
): string {
  const today = todayJalaaliInTimezone(TEHRAN_TIMEZONE);
  const heading =
    scope === 'day' ? '📊 درآمد و هزینه امروز' : '📊 درآمد و هزینه این ماه';
  const dateLine =
    scope === 'day'
      ? `${toPersianDigits(formatJalaaliHuman(today))} · ${JALALI_WEEKDAY_NAMES[jalaaliWeekday(today)] ?? ''}`
      : formatPeriodLabel(clampPeriodToToday(periodContaining('month', today)));

  const lines = [
    heading,
    TELEGRAM_SEPARATOR,
    `📅 ${dateLine}`,
    '',
    '🇮🇷 تومان',
    `💚 درآمد: ${formatTelegramMoney(toman.income, 'TOMAN')}`,
    `🔴 هزینه: ${formatTelegramMoney(toman.expense, 'TOMAN')}`,
    `📈 خالص: ${formatTelegramMoney(toman.net, 'TOMAN')}`,
    '',
    '🇺🇸 دلار',
    `💚 درآمد: ${formatTelegramMoney(usd.income, 'USD')}`,
    `🔴 هزینه: ${formatTelegramMoney(usd.expense, 'USD')}`,
    `📈 خالص: ${formatTelegramMoney(usd.net, 'USD')}`,
  ];

  const unpriced = toman.unpricedCount + usd.unpricedCount;
  if (unpriced > 0) {
    lines.push(
      '',
      `⚠️ ${toPersianDigits(unpriced)} تراکنش بدون نرخ — در جمع لحاظ نشده.`
    );
  }

  lines.push('', TELEGRAM_SEPARATOR);
  return lines.join('\n').trim();
}

export function formatTodayCashflowMessage(
  todayToman: CashflowSummary,
  todayUsd: CashflowSummary
): string {
  return formatCashflowMessage('day', todayToman, todayUsd);
}

export function formatMonthCashflowMessage(
  monthToman: CashflowSummary,
  monthUsd: CashflowSummary
): string {
  return formatCashflowMessage('month', monthToman, monthUsd);
}
