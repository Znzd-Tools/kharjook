/**
 * New dashboard numbers (UX plan §9.2). Pure, tested.
 */
import type { Asset, DailyPrice, Transaction } from '@/shared/types/domain';
import { addDays, formatJalaali, jalaaliMonthLength, type JalaaliDate } from '@/shared/utils/jalali';
import { effectivePriceAt } from '@/features/reports/utils/price-history';
import { calculateAssetStats } from '@/shared/utils/calculate-asset-stats';

const expenseToman = (rows: Transaction[]) =>
  rows.reduce((s, t) => (t.type === 'EXPENSE' && t.amount_toman_at_time != null ? s + Number(t.amount_toman_at_time) : s), 0);
const incomeToman = (rows: Transaction[]) =>
  rows.reduce((s, t) => (t.type === 'INCOME' && t.amount_toman_at_time != null ? s + Number(t.amount_toman_at_time) : s), 0);

const pad = (n: number) => String(n).padStart(2, '0');
const monthStart = (jy: number, jm: number) => `${jy}/${pad(jm)}/01`;
function prevMonth(jy: number, jm: number) {
  return jm === 1 ? { jy: jy - 1, jm: 12 } : { jy, jm: jm - 1 };
}

/** Average monthly expense of the last `months` full months. */
export function avgMonthlyExpense(transactions: Transaction[], today: JalaaliDate, months = 3): number {
  let total = 0;
  let { jy, jm } = today;
  for (let i = 0; i < months; i++) {
    ({ jy, jm } = prevMonth(jy, jm));
    const from = monthStart(jy, jm);
    const to = `${jy}/${pad(jm)}/${pad(jalaaliMonthLength(jy, jm))}`;
    total += expenseToman(transactions.filter((t) => t.date_string >= from && t.date_string <= to));
  }
  return total / months;
}

/** Months the cash covers at the average monthly expense; null if no spending data. */
export function runwayMonths(cashToman: number, avgMonthly: number): number | null {
  if (!(avgMonthly > 0)) return null;
  return Math.max(0, cashToman) / avgMonthly;
}

/** (income − expense) / income in percent; null without income. */
export function savingsRate(income: number, expense: number): number | null {
  return income > 0 ? ((income - expense) / income) * 100 : null;
}

/**
 * This month's expense to date vs last month up to the same day.
 * Returns the change in percent (negative = spending less).
 */
export function spendVsLastMonth(transactions: Transaction[], today: JalaaliDate): { now: number; before: number; change: number | null } {
  const from = monthStart(today.jy, today.jm);
  const now = expenseToman(transactions.filter((t) => t.date_string >= from && t.date_string <= formatJalaali(today)));
  const p = prevMonth(today.jy, today.jm);
  const day = Math.min(today.jd, jalaaliMonthLength(p.jy, p.jm));
  const before = expenseToman(
    transactions.filter((t) => t.date_string >= monthStart(p.jy, p.jm) && t.date_string <= `${p.jy}/${pad(p.jm)}/${pad(day)}`)
  );
  return { now, before, change: before > 0 ? ((now - before) / before) * 100 : null };
}

/** Where spending "should" be by today, as a share of the month (0..1). */
export function monthProgress(today: JalaaliDate): number {
  return today.jd / jalaaliMonthLength(today.jy, today.jm);
}

/** Cash above `months` of average expense (the idle part). */
export function idleCash(cashToman: number, avgMonthly: number, months = 3): number {
  return Math.max(0, cashToman - avgMonthly * months);
}

export interface Mover {
  asset: Asset;
  changePct: number;
  priceToman: number;
  /** Change in value of what you hold, in toman. */
  valueChangeToman: number;
}

/**
 * Price change since yesterday for held assets — only when BOTH prices are
 * fresh (dated within `maxAgeDays`). Without this rule an asset with no
 * recent price fell back to an old trade price and showed a fake "today"
 * jump.
 */
export function priceMoves(assets: Asset[], transactions: Transaction[], dailyPrices: DailyPrice[], usdRate: number, today: JalaaliDate, maxAgeDays = 3): Mover[] {
  const todayStr = formatJalaali(today);
  const yesterday = formatJalaali(addDays(today, -1));
  const oldest = formatJalaali(addDays(today, -(maxAgeDays + 1)));
  const out: Mover[] = [];
  for (const asset of assets) {
    if (asset.include_in_balance === false) continue;
    const qty = calculateAssetStats(asset, transactions, 'TOMAN', usdRate).totalAmount;
    if (qty <= 0) continue;
    const now = effectivePriceAt(asset, todayStr, dailyPrices, todayStr, transactions);
    const prev = effectivePriceAt(asset, yesterday, dailyPrices, todayStr, transactions);
    if (!now || !prev || !(prev.priceToman > 0)) continue;
    if (prev.sourceDate < oldest) continue; // stale: not a real "since yesterday"
    const diff = now.priceToman - prev.priceToman;
    if (diff === 0) continue;
    out.push({ asset, changePct: (diff / prev.priceToman) * 100, priceToman: now.priceToman, valueChangeToman: diff * qty });
  }
  return out;
}

/** Held assets with the biggest fresh price change since yesterday. */
export function topMovers(assets: Asset[], transactions: Transaction[], dailyPrices: DailyPrice[], usdRate: number, today: JalaaliDate, limit = 3): Mover[] {
  return priceMoves(assets, transactions, dailyPrices, usdRate, today)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, limit);
}

/** Today's change of your holdings from price moves only (fresh prices). */
export function todayMarketMove(assets: Asset[], transactions: Transaction[], dailyPrices: DailyPrice[], usdRate: number, today: JalaaliDate): number {
  return priceMoves(assets, transactions, dailyPrices, usdRate, today).reduce((s, m) => s + m.valueChangeToman, 0);
}

/**
 * Held assets whose newest stored price is older than `maxAgeDays`
 * (S25: the daily job refreshes provider prices; this flags the rest).
 */
export function stalePriceAssets(assets: Asset[], transactions: Transaction[], dailyPrices: DailyPrice[], usdRate: number, today: JalaaliDate, maxAgeDays = 3): Asset[] {
  const cutoff = formatJalaali(addDays(today, -maxAgeDays));
  const latest = new Map<string, string>();
  for (const p of dailyPrices) {
    const cur = latest.get(p.asset_id);
    if (!cur || p.date_string > cur) latest.set(p.asset_id, p.date_string);
  }
  return assets.filter((a) => {
    if (a.include_in_balance === false) return false;
    if (calculateAssetStats(a, transactions, 'TOMAN', usdRate).totalAmount <= 0) return false;
    const last = latest.get(a.id);
    return !last || last < cutoff;
  });
}

export { incomeToman, expenseToman };
