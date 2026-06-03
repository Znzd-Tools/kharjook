import type { UserNotificationSnapshot } from '@/features/notifications/utils/build-user-snapshot';
import { formatMonthCashflowMessage, formatTodayCashflowMessage } from '@/features/notifications/telegram/utils/format-today-cashflow';
import { formatPortfolioMessage } from '@/features/notifications/telegram/utils/format-portfolio';
import { TELEGRAM_SEPARATOR } from '@/features/notifications/telegram/utils/format-helpers';
import type { NotificationReportInterval } from '@/shared/types/domain';

export function formatScheduledReportMessage(input: {
  interval: NotificationReportInterval;
  snapshot: UserNotificationSnapshot & {
    todayUsd: { income: number; expense: number; net: number; unpricedCount: number };
    monthUsd: { income: number; expense: number; net: number; unpricedCount: number };
  };
  showPortfolioIrt: boolean;
  showPortfolioUsd: boolean;
  showCashflowIrt: boolean;
  showCashflowUsd: boolean;
}): string {
  const parts: string[] = [];

  if (input.interval === 'weekly') {
    parts.push('📬 گزارش هفتگی خرجوک');
  } else {
    parts.push('📬 گزارش روزانه خرجوک');
  }

  if (input.showCashflowIrt || input.showCashflowUsd) {
    const cashflowText =
      input.interval === 'weekly'
        ? formatMonthCashflowMessage(input.snapshot.month, input.snapshot.monthUsd)
        : formatTodayCashflowMessage(input.snapshot.today, input.snapshot.todayUsd);

    if (input.showCashflowIrt && input.showCashflowUsd) {
      parts.push(cashflowText);
    } else if (input.showCashflowIrt) {
      parts.push(stripUsdSection(cashflowText));
    } else {
      parts.push(stripTomanSection(cashflowText));
    }
  }

  if (input.showPortfolioIrt || input.showPortfolioUsd) {
    const portfolioText = formatPortfolioMessage(input.snapshot.portfolio);
    if (input.showPortfolioIrt && input.showPortfolioUsd) {
      parts.push(portfolioText);
    } else if (input.showPortfolioIrt) {
      parts.push(stripUsdSection(portfolioText));
    } else {
      parts.push(stripTomanSection(portfolioText));
    }
  }

  if (parts.length === 1) {
    parts.push('تنظیمات نمایش گزارش خالی است.');
  }

  return parts.join(`\n\n${TELEGRAM_SEPARATOR}\n\n`).trim();
}

function stripUsdSection(text: string): string {
  const marker = '🇺🇸';
  const idx = text.indexOf(marker);
  if (idx === -1) return text.trim();
  return text.slice(0, idx).trim();
}

function stripTomanSection(text: string): string {
  const marker = '🇺🇸';
  const idx = text.indexOf(marker);
  if (idx === -1) return text.trim();
  return text.slice(idx).trim();
}
