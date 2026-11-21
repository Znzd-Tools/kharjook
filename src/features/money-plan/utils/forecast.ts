/**
 * Cash-flow forecast. Pure, no I/O.
 *
 * Start: cash in all wallets (Toman). Each day: expected income on its usual
 * day, normal spending spread evenly, and every scheduled payment on its due
 * date. Payments in an asset (e.g. a USDT installment) are paid from that
 * asset, not from cash: they are listed apart with whether you hold enough.
 */
import type { Currency, CurrencyRate, Subscription, Transaction, Wallet } from '@/shared/types/domain';
import { addDays, formatJalaali, jalaaliMonthLength, parseJalaali, type JalaaliDate } from '@/shared/utils/jalali';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';
import { addIntervalDate } from '@/features/deadlines/utils/schedule';

const pad = (n: number) => String(n).padStart(2, '0');
const monthKeyOf = (d: string) => d.slice(0, 7);

function prevMonth(jy: number, jm: number) {
  return jm === 1 ? { jy: jy - 1, jm: 12 } : { jy, jm: jm - 1 };
}

/** The last `n` full Jalali months before `today`, oldest first, as "YYYY/MM". */
export function lastFullMonths(today: JalaaliDate, n: number): string[] {
  const out: string[] = [];
  let { jy, jm } = today;
  for (let i = 0; i < n; i++) {
    ({ jy, jm } = prevMonth(jy, jm));
    out.unshift(`${jy}/${pad(jm)}`);
  }
  return out;
}

const txToman = (t: Transaction, side: 'source' | 'target', wallets: Map<string, Wallet>, rates: CurrencyRate[], usdRate: number) => {
  if (t.amount_toman_at_time != null && Number(t.amount_toman_at_time) > 0) return Number(t.amount_toman_at_time);
  const w = wallets.get((side === 'source' ? t.source_wallet_id : t.target_wallet_id) ?? '');
  const amt = Number(side === 'source' ? t.source_amount : t.target_amount) || 0;
  if (!w) return 0;
  const r = w.currency === 'IRT' ? 1 : w.currency === 'USD' && usdRate > 0 ? usdRate : tomanPerUnit(w.currency, rates);
  return amt * r;
};

export interface IncomePattern {
  categoryId: string | null;
  label: string;
  monthlyToman: number;
  /** Day of month it usually arrives. */
  day: number;
}

/**
 * Regular income: a category with income into a wallet in at least 2 of the
 * last 3 full months. Amount = median of those months, day = day of the
 * latest one.
 */
export function detectIncome(
  transactions: Transaction[],
  today: JalaaliDate,
  categoryName: (id: string | null) => string,
  wallets: Wallet[],
  rates: CurrencyRate[],
  usdRate: number
): IncomePattern[] {
  const months = lastFullMonths(today, 3);
  const wById = new Map(wallets.map((w) => [w.id, w]));
  const byCat = new Map<string, { perMonth: Map<string, number>; lastDate: string }>();
  for (const t of transactions) {
    if (t.type !== 'INCOME' || !t.target_wallet_id) continue;
    const m = monthKeyOf(t.date_string);
    if (!months.includes(m)) continue;
    const key = t.category_id ?? '__none';
    const row = byCat.get(key) ?? { perMonth: new Map(), lastDate: '' };
    row.perMonth.set(m, (row.perMonth.get(m) ?? 0) + txToman(t, 'target', wById, rates, usdRate));
    if (t.date_string > row.lastDate) row.lastDate = t.date_string;
    byCat.set(key, row);
  }
  const out: IncomePattern[] = [];
  for (const [key, row] of byCat) {
    if (row.perMonth.size < 2) continue;
    const vals = [...row.perMonth.values()].sort((a, b) => a - b);
    const median = vals.length % 2 ? vals[(vals.length - 1) / 2]! : (vals[vals.length / 2 - 1]! + vals[vals.length / 2]!) / 2;
    const categoryId = key === '__none' ? null : key;
    out.push({ categoryId, label: categoryName(categoryId), monthlyToman: median, day: Number(row.lastDate.slice(8, 10)) || 1 });
  }
  return out.sort((a, b) => b.monthlyToman - a.monthlyToman);
}

/**
 * Normal monthly spending: average of the last 3 full months of expenses paid
 * from wallets, without payments of scheduled items (cheques, installments,
 * subscriptions): those are counted on their own dates.
 */
export function normalMonthlySpending(
  transactions: Transaction[],
  today: JalaaliDate,
  scheduledPaymentTxIds: Set<string>,
  wallets: Wallet[],
  rates: CurrencyRate[],
  usdRate: number
): number {
  const months = lastFullMonths(today, 3);
  const wById = new Map(wallets.map((w) => [w.id, w]));
  let total = 0;
  for (const t of transactions) {
    if (t.type !== 'EXPENSE' || !t.source_wallet_id) continue;
    if (!months.includes(monthKeyOf(t.date_string))) continue;
    if (scheduledPaymentTxIds.has(t.id)) continue;
    total += txToman(t, 'source', wById, rates, usdRate);
  }
  return total / months.length;
}

export interface ScheduledOutflow {
  due: string;
  label: string;
  /** Money items: Toman. */
  toman: number;
}

/** Future dates of a subscription inside [from, to]. */
export function subscriptionDates(s: Pick<Subscription, 'next_due_date_string' | 'interval_number' | 'interval_period'>, from: string, to: string): string[] {
  const out: string[] = [];
  let d = parseJalaali(s.next_due_date_string);
  let guard = 0;
  while (d && guard++ < 400) {
    const str = formatJalaali(d);
    if (str > to) break;
    // overdue ones count as due today
    out.push(str < from ? from : str);
    d = addIntervalDate(d, Math.max(1, s.interval_number), s.interval_period);
  }
  return out;
}

export interface ForecastDay {
  date: string;
  income: number;
  outflow: number;
  balance: number;
}

export interface ForecastEvent {
  date: string;
  label: string;
  toman: number;
  kind: 'income' | 'payment';
}

export interface Forecast {
  days: ForecastDay[];
  events: ForecastEvent[];
  lowest: { date: string; balance: number };
  firstNegative: string | null;
  months: { month: string; income: number; outflow: number; end: number }[];
}

export function buildForecast(input: {
  today: JalaaliDate;
  horizonDays: number;
  startCash: number;
  income: IncomePattern[];
  monthlySpending: number;
  scheduled: ScheduledOutflow[];
}): Forecast {
  const { today, horizonDays, startCash, income, monthlySpending, scheduled } = input;
  const todayStr = formatJalaali(today);
  const days: ForecastDay[] = [];
  const events: ForecastEvent[] = [];
  let balance = startCash;
  let lowest = { date: todayStr, balance: startCash };
  let firstNegative: string | null = startCash < 0 ? todayStr : null;
  const byDate = new Map<string, ScheduledOutflow[]>();
  for (const s of scheduled) {
    const d = s.due < todayStr ? todayStr : s.due;
    byDate.set(d, [...(byDate.get(d) ?? []), s]);
  }
  for (let i = 0; i < horizonDays; i++) {
    const date = addDays(today, i);
    const ds = formatJalaali(date);
    const monthLen = jalaaliMonthLength(date.jy, date.jm);
    let inToday = 0;
    for (const p of income) {
      const day = Math.min(p.day, monthLen);
      // the income of this month is already in if its day has passed today
      if (date.jd === day && !(i === 0 && day < today.jd)) {
        inToday += p.monthlyToman;
        events.push({ date: ds, label: p.label, toman: p.monthlyToman, kind: 'income' });
      }
    }
    let out = monthlySpending / monthLen;
    for (const s of byDate.get(ds) ?? []) {
      out += s.toman;
      events.push({ date: ds, label: s.label, toman: s.toman, kind: 'payment' });
    }
    balance += inToday - out;
    days.push({ date: ds, income: inToday, outflow: out, balance });
    if (balance < lowest.balance) lowest = { date: ds, balance };
    if (firstNegative === null && balance < 0) firstNegative = ds;
  }
  const months: Forecast['months'] = [];
  for (const d of days) {
    const m = monthKeyOf(d.date);
    const row = months.find((x) => x.month === m);
    if (row) {
      row.income += d.income;
      row.outflow += d.outflow;
      row.end = d.balance;
    } else months.push({ month: m, income: d.income, outflow: d.outflow, end: d.balance });
  }
  return { days, events, lowest, firstNegative, months };
}

export const moneyRate = (currency: Currency, rates: CurrencyRate[], usdRate: number) =>
  currency === 'IRT' ? 1 : currency === 'USD' && usdRate > 0 ? usdRate : tomanPerUnit(currency, rates);
