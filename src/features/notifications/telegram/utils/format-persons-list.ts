import type { Person, Transaction } from '@/shared/types/domain';
import { calculatePersonBalance } from '@/shared/utils/calculate-person-balance';
import {
  formatJalaaliHuman,
  jalaaliWeekday,
  todayJalaaliInTimezone,
} from '@/shared/utils/jalali';
import { TEHRAN_TIMEZONE } from '@/features/notifications/telegram/utils/format-debts-list';
import {
  JALALI_WEEKDAY_NAMES,
  TELEGRAM_SEPARATOR,
  toPersianDigits,
} from '@/features/notifications/telegram/utils/format-helpers';

export type PersonBalanceRow = {
  person: Person;
  balance: number;
  status: 'بدهکار' | 'بستانکار' | 'تسویه';
};

export function buildPersonBalanceRows(
  persons: Person[],
  transactions: Transaction[]
): PersonBalanceRow[] {
  return [...persons]
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map((person) => {
      const balance = calculatePersonBalance(person, transactions);
      const status =
        balance > 0 ? 'بدهکار' : balance < 0 ? 'بستانکار' : 'تسویه';
      return { person, balance, status };
    });
}

function formatAmount(balance: number): string {
  return toPersianDigits(
    Math.abs(balance).toLocaleString('en-US', { maximumFractionDigits: 6 })
  );
}

export function formatPersonsSummaryMessage(rows: PersonBalanceRow[]): string {
  const today = todayJalaaliInTimezone(TEHRAN_TIMEZONE);
  const weekday = JALALI_WEEKDAY_NAMES[jalaaliWeekday(today)] ?? '';
  const dateLine = `${toPersianDigits(formatJalaaliHuman(today))} · ${weekday}`;

  if (rows.length === 0) {
    return [
      '👥 خلاصه اشخاص',
      TELEGRAM_SEPARATOR,
      `📅 ${dateLine}`,
      '',
      'هنوز شخصی ثبت نشده.',
      TELEGRAM_SEPARATOR,
    ].join('\n');
  }

  let receivable = 0;
  let payable = 0;
  const lines = ['👥 خلاصه اشخاص', TELEGRAM_SEPARATOR, `📅 ${dateLine}`, ''];

  for (const row of rows) {
    if (row.balance > 0) receivable += row.balance;
    else if (row.balance < 0) payable += Math.abs(row.balance);

    const icon =
      row.status === 'بدهکار' ? '🟡' : row.status === 'بستانکار' ? '🔵' : '⚪';
    lines.push(`${icon} ${row.person.name}`);
    lines.push(`   ${row.status} · ${formatAmount(row.balance)}`);
    lines.push('');
  }

  const unsettled = rows.filter((row) => row.balance !== 0).length;
  if (unsettled > 0) {
    lines.push(
      `📊 طلب: ${formatAmount(receivable)} · بدهی: ${formatAmount(payable)}`,
      ''
    );
  }

  lines.push(TELEGRAM_SEPARATOR);
  return lines.join('\n').trim();
}
