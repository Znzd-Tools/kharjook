/**
 * "Net worth change, explained" (UX plan P5): this month's change split
 * into saving (income − expense) and price change + other.
 */
import type { Asset, CurrencyRate, DailyPrice, Transaction, Wallet } from '@/shared/types/domain';
import { formatJalaali, type JalaaliDate } from '@/shared/utils/jalali';
import { endOfPreviousJalaliMonth, portfolioTotalTomanAtDate } from '@/features/dashboard/utils/portfolio-history';
import { netToman } from '@/features/transactions/utils/describe-transaction';

export interface NetWorthChange {
  start: number;
  end: number;
  change: number;
  saving: number;
  marketAndOther: number;
}

export function netWorthChangeThisMonth(
  input: { assets: Asset[]; transactions: Transaction[]; wallets: Wallet[]; dailyPrices: DailyPrice[]; currencyRates: CurrencyRate[] },
  today: JalaaliDate
): NetWorthChange {
  const todayStr = formatJalaali(today);
  const prevEnd = formatJalaali(endOfPreviousJalaliMonth(today));
  const at = (d: string) =>
    portfolioTotalTomanAtDate(input.assets, input.transactions, input.wallets, input.dailyPrices, input.currencyRates, todayStr, d).totalToman;
  const start = at(prevEnd);
  const end = at(todayStr);
  const monthRows = input.transactions.filter((t) => t.date_string > prevEnd && t.date_string <= todayStr);
  const { income, expense } = netToman(monthRows);
  const saving = income - expense;
  return { start, end, change: end - start, saving, marketAndOther: end - start - saving };
}
