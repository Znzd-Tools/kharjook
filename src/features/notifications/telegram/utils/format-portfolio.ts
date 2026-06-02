import type { PortfolioSummary } from '@/features/notifications/utils/build-user-snapshot';
import {
  formatJalaaliHuman,
  jalaaliWeekday,
  todayJalaaliInTimezone,
} from '@/shared/utils/jalali';
import { TEHRAN_TIMEZONE } from '@/features/notifications/telegram/utils/format-debts-list';
import {
  formatTelegramMoney,
  JALALI_WEEKDAY_NAMES,
  TELEGRAM_SEPARATOR,
  toPersianDigits,
} from '@/features/notifications/telegram/utils/format-helpers';

export function formatPortfolioMessage(portfolio: PortfolioSummary): string {
  const today = todayJalaaliInTimezone(TEHRAN_TIMEZONE);
  const weekday = JALALI_WEEKDAY_NAMES[jalaaliWeekday(today)] ?? '';
  const dateLine = `${toPersianDigits(formatJalaaliHuman(today))} · ${weekday}`;

  return [
    '💼 ارزش پرتفوی',
    TELEGRAM_SEPARATOR,
    `📅 ${dateLine}`,
    '',
    `🇮🇷 ${formatTelegramMoney(portfolio.totalToman, 'TOMAN')}`,
    `💵 نقد: ${formatTelegramMoney(portfolio.cashToman, 'TOMAN')}`,
    `📦 دارایی: ${formatTelegramMoney(portfolio.assetsToman, 'TOMAN')}`,
    '',
    `🇺🇸 ${formatTelegramMoney(portfolio.totalUsd, 'USD')}`,
    TELEGRAM_SEPARATOR,
  ].join('\n');
}
