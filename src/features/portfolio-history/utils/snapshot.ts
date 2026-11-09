/**
 * One net-worth snapshot for a date (pure). Same math as the Home chart
 * (portfolio-history.ts), so the stored history and the screens agree.
 */
import type { Asset, CurrencyRate, DailyPrice, Transaction, Wallet } from '@/shared/types/domain';
import { effectivePriceAt } from '@/features/reports/utils/price-history';
import { assetNetAmountThroughDate, portfolioCashTomanAtDate } from '@/features/dashboard/utils/portfolio-history';
import { addDays, formatJalaali, jalaaliMonthLength, parseJalaali } from '@/shared/utils/jalali';

export interface SnapshotRow {
  date_string: string;
  total_toman: number;
  total_usd: number;
  assets_toman: number;
  cash_toman: number;
  usd_rate: number | null;
  missing_price_count: number;
  by_asset: Record<string, { qty: number; toman: number; usd: number }>;
  by_group: Record<string, number>;
}

export function buildSnapshot(input: {
  assets: Asset[];
  wallets: Wallet[];
  transactions: Transaction[];
  dailyPrices: DailyPrice[];
  currencyRates: CurrencyRate[];
  /** Toman per USD on that date (today's rate for a daily row). */
  usdRate: number;
  todayStr: string;
  dateStr: string;
}): SnapshotRow {
  const { assets, wallets, transactions, dailyPrices, currencyRates, usdRate, todayStr, dateStr } = input;
  const byAsset: SnapshotRow['by_asset'] = {};
  const byGroup: Record<string, number> = {};
  let assetsToman = 0;
  let assetsUsd = 0;
  let missing = 0;
  for (const asset of assets) {
    if (asset.include_in_balance === false) continue;
    const qty = assetNetAmountThroughDate(asset.id, transactions, dateStr);
    if (qty <= 0) continue;
    const p = effectivePriceAt(asset, dateStr, dailyPrices, todayStr, transactions);
    if (!p) {
      missing++;
      continue;
    }
    const toman = qty * p.priceToman;
    const usd = p.priceUsd > 0 ? qty * p.priceUsd : usdRate > 0 ? toman / usdRate : 0;
    byAsset[asset.id] = { qty, toman: Math.round(toman), usd: Math.round(usd * 100) / 100 };
    const g = asset.category_id ?? '__none__';
    byGroup[g] = Math.round((byGroup[g] ?? 0) + toman);
    assetsToman += toman;
    assetsUsd += usd;
  }
  const cash = portfolioCashTomanAtDate(wallets, transactions, currencyRates, dateStr);
  const total = assetsToman + cash;
  return {
    date_string: dateStr,
    total_toman: Math.round(total),
    total_usd: Math.round((assetsUsd + (usdRate > 0 ? cash / usdRate : 0)) * 100) / 100,
    assets_toman: Math.round(assetsToman),
    cash_toman: Math.round(cash),
    usd_rate: usdRate > 0 ? usdRate : null,
    missing_price_count: missing,
    by_asset: byAsset,
    by_group: byGroup,
  };
}

/** Last day of each of the `count` months before the month of `todayStr`. */
export function pastMonthEnds(todayStr: string, count: number): string[] {
  const t = parseJalaali(todayStr);
  if (!t) return [];
  const out: string[] = [];
  let y = t.jy;
  let m = t.jm;
  for (let i = 0; i < count; i++) {
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
    out.push(formatJalaali({ jy: y, jm: m, jd: jalaaliMonthLength(y, m) }));
  }
  return out.reverse();
}

export { addDays };
