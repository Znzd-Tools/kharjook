/**
 * Portfolio profit and loss for the three views (UX plan §5, P1–P2):
 *   دوره فعلی (active) · امسال (year) · از ابتدا (allTime)
 *
 * No new math: sums `computeAssetPnl` per asset and takes the year total
 * from `computeYtdUnrealizedSummary`, exactly like the v1 dashboard. A
 * golden test checks the totals match the v1 numbers.
 */
import type { Asset, DailyPrice, Transaction } from '@/shared/types/domain';
import { computeAssetPnl, type AssetPnl, type PnlPart } from '@/features/reports/utils/asset-pnl';
import { computeYtdUnrealizedSummary } from '@/features/reports/utils/ytd-unrealized';

export type PnlView = 'active' | 'year' | 'allTime';

export interface PnlTotals {
  value: PnlPart;
  realized: PnlPart;
  unrealized: PnlPart;
  /** Denominator of the percent. */
  base: PnlPart;
}

export interface PnlSummary {
  active: PnlTotals;
  year: PnlTotals;
  allTime: PnlTotals;
  rows: { asset: Asset; pnl: AssetPnl }[];
  /** Assets held without any price (their open part is not counted). */
  missingPriceCount: number;
  /** Held assets excluded from P/L by the user. */
  excludedCount: number;
  /** Year value is partial (missing opening / closing price). */
  yearPartialCount: number;
}

const zero = (): PnlPart => ({ toman: 0, usd: 0 });
const add = (a: PnlPart, b: PnlPart) => {
  a.toman += b.toman;
  a.usd += b.usd;
};
const totals = (): PnlTotals => ({ value: zero(), realized: zero(), unrealized: zero(), base: zero() });

export function percentOf(t: PnlTotals, unit: 'toman' | 'usd'): number | null {
  const base = t.base[unit];
  return base > 0 ? (t.value[unit] / base) * 100 : null;
}

export function buildPnlSummary(
  assets: Asset[],
  transactions: Transaction[],
  dailyPrices: DailyPrice[],
  usdRate: number,
  todayStr: string
): PnlSummary {
  const active = totals();
  const year = totals();
  const allTime = totals();
  const rows: PnlSummary['rows'] = [];
  let missingPriceCount = 0;
  let excludedCount = 0;

  for (const asset of assets) {
    const pnl = computeAssetPnl(asset, transactions, dailyPrices, usdRate, todayStr);
    rows.push({ asset, pnl });
    if (!pnl.included) {
      if (pnl.holdings > 0) excludedCount += 1;
      continue;
    }
    if (pnl.holdings > 0 && !pnl.active.available) missingPriceCount += 1;
    // Same rule as the v1 dashboard: only open positions with a cost.
    if (pnl.holdings > 0 && pnl.active.cost.toman > 0) {
      add(active.value, pnl.active.value);
      add(active.unrealized, pnl.active.value);
      add(active.base, pnl.active.cost);
    }
    add(year.realized, pnl.year.realized);
    add(year.unrealized, pnl.year.open);
    add(year.base, pnl.year.base);
    add(allTime.value, pnl.allTime.value);
    add(allTime.realized, pnl.allTime.realized);
    add(allTime.unrealized, pnl.allTime.open);
    add(allTime.base, pnl.allTime.invested);
  }

  const ytd = computeYtdUnrealizedSummary(assets, transactions, dailyPrices, usdRate, todayStr);
  year.value = { toman: ytd.totalToman, usd: ytd.totalUsd };

  return { active, year, allTime, rows, missingPriceCount, excludedCount, yearPartialCount: ytd.partialTotalCount };
}

/** Per-asset value for one view (for the list on the PnL screen). */
export function assetValueFor(pnl: AssetPnl, view: PnlView): PnlPart {
  if (!pnl.included) return zero();
  if (view === 'active') return pnl.holdings > 0 && pnl.active.cost.toman > 0 ? pnl.active.value : zero();
  if (view === 'year') return pnl.year.value;
  return pnl.allTime.value;
}

export const VIEW_LABEL: Record<PnlView, string> = {
  active: 'دوره فعلی',
  year: 'امسال',
  allTime: 'از ابتدا',
};

export const VIEW_HINT: Record<PnlView, string> = {
  active: 'سود یا زیانِ دارایی‌هایی که الان داری، از آخرین باری که موجودی‌شان صفر شد.',
  year: 'نتیجه امسال (از ۱ فروردین): فروش‌های امسال + تغییر ارزش آنچه داری.',
  allTime: 'همه فروش‌ها و ارزش فعلی منهای همه خریدها، از اولین تراکنش.',
};
