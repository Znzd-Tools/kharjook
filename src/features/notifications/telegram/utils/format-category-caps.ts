import {
  formatTelegramMoney,
  TELEGRAM_SEPARATOR,
  toPersianDigits,
} from '@/features/notifications/telegram/utils/format-helpers';

export function formatCapThresholdAlertMessage(input: {
  categoryName: string;
  threshold: 80 | 100;
  spentToman: number;
  limitToman: number;
}): string {
  const icon = input.threshold >= 100 ? '🔴' : '🟠';
  const label = input.threshold >= 100 ? 'سقف تمام شد' : 'نزدیک سقف';
  const pct = Math.min(Math.round((input.spentToman / input.limitToman) * 100), 999);
  return [
    `${icon} ${label}`,
    TELEGRAM_SEPARATOR,
    `🏷 ${input.categoryName}`,
    `💰 ${formatTelegramMoney(input.spentToman, 'TOMAN')} از ${formatTelegramMoney(input.limitToman, 'TOMAN')}`,
    `📊 ${toPersianDigits(pct)}٪ مصرف شده`,
    TELEGRAM_SEPARATOR,
  ].join('\n');
}

export function formatExpenseCapLine(input: {
  categoryName: string;
  spentToman: number;
  limitToman: number;
  percent: number;
}): string {
  const pct = Math.min(Math.round(input.percent), 999);
  const icon = input.percent >= 100 ? '🔴' : '🟠';
  return `${icon} سقف «${input.categoryName}»: ${toPersianDigits(pct)}٪ (${formatTelegramMoney(input.spentToman, 'TOMAN')} / ${formatTelegramMoney(input.limitToman, 'TOMAN')})`;
}
