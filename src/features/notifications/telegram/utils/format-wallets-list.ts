import type { Wallet } from '@/shared/types/domain';
import { calculateWalletStats } from '@/shared/utils/calculate-wallet-balance';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';
import type { CurrencyRate, Transaction } from '@/shared/types/domain';
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

export function formatWalletBalancesMessage(input: {
  wallets: Wallet[];
  transactions: Transaction[];
  currencyRates: CurrencyRate[];
}): string {
  const today = todayJalaaliInTimezone(TEHRAN_TIMEZONE);
  const weekday = JALALI_WEEKDAY_NAMES[jalaaliWeekday(today)] ?? '';
  const dateLine = `${toPersianDigits(formatJalaaliHuman(today))} · ${weekday}`;

  const active = input.wallets
    .filter((w) => !w.archived_at)
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));

  if (active.length === 0) {
    return [
      '💳 موجودی کیف‌ها',
      TELEGRAM_SEPARATOR,
      `📅 ${dateLine}`,
      '',
      'کیف پول فعالی ندارید.',
      TELEGRAM_SEPARATOR,
    ].join('\n');
  }

  let totalToman = 0;
  const lines: string[] = [
    '💳 موجودی کیف‌ها',
    TELEGRAM_SEPARATOR,
    `📅 ${dateLine}`,
    '',
  ];

  for (const wallet of active) {
    const stats = calculateWalletStats(wallet, input.transactions);
    const rate = tomanPerUnit(wallet.currency, input.currencyRates);
    const balanceToman = stats.balance * rate;
    totalToman += balanceToman;
    lines.push(`👛 ${wallet.name}`);
    lines.push(
      `   ${formatTelegramMoney(stats.balance, wallet.currency === 'IRT' ? 'TOMAN' : 'USD')} · ${formatTelegramMoney(balanceToman, 'TOMAN')}`
    );
  }

  lines.push('', `📊 جمع: ${formatTelegramMoney(totalToman, 'TOMAN')}`, TELEGRAM_SEPARATOR);
  return lines.join('\n');
}
