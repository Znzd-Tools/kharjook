/**
 * The three P/L numbers of one asset, from one place, so every screen shows
 * the same values.
 *
 *  1. active   — open (unrealized) P/L of the units held NOW.
 *                value now − cost basis of the current position.
 *                The cost basis resets to 0 every time holdings reach 0, so a
 *                closed position never leaks into the next one.
 *  2. year     — P/L during the current Jalali year (1 Farvardin → today):
 *                value today − value at year start − buys + sells in the year.
 *                Units held on 1 Farvardin count at the previous day's close.
 *  3. allTime  — P/L since the first transaction:
 *                value now + all sell proceeds − all buy costs
 *                (= realized + active).
 *
 * Price history: a daily snapshot is used when it exists; otherwise the unit
 * price of the newest BUY / SELL on or before that date is used. With no live
 * price cached, the newest historical price marks today.
 */

import type { Asset, CurrencyMode, DailyPrice, Transaction } from '@/shared/types/domain';
import { calculateAssetStats } from '@/shared/utils/calculate-asset-stats';
import { effectivePriceAt } from '@/features/reports/utils/price-history';
import { ytdUnrealizedForAsset } from '@/features/reports/utils/ytd-unrealized';

export interface PnlPart {
  toman: number;
  usd: number;
}

export interface AssetPnl {
  /** False when the asset is excluded from P/L (`include_in_profit_loss`). */
  included: boolean;
  holdings: number;
  active: {
    value: PnlPart;
    /** Cost basis of the open position (denominator of the %). */
    cost: PnlPart;
    /** First buy date of the open position (after the last zero). */
    since: string | null;
    /** False when there are holdings but no price at all to mark them. */
    available: boolean;
  };
  year: {
    value: PnlPart;
    realized: PnlPart;
    open: PnlPart;
    /** Opening value + buys in the year (denominator of the %). */
    base: PnlPart;
    /** Some input was missing (no opening / closing price); value is partial. */
    partial: boolean;
    /** No activity and no holdings in the year. */
    empty: boolean;
  };
  allTime: {
    value: PnlPart;
    realized: PnlPart;
    open: PnlPart;
    /** Sum of every buy ever (denominator of the %). */
    invested: PnlPart;
  };
}

export function pick(part: PnlPart, mode: CurrencyMode): number {
  return mode === 'USD' ? part.usd : part.toman;
}

/** Percent of `value` over `base` in the chosen currency; null when base ≤ 0. */
export function pnlPercent(value: PnlPart, base: PnlPart, mode: CurrencyMode): number | null {
  const b = pick(base, mode);
  if (!(b > 0)) return null;
  return (pick(value, mode) / b) * 100;
}

/** Price that marks holdings today: live cache first, then newest history. */
function markPrice(
  asset: Asset,
  dailyPrices: DailyPrice[],
  transactions: Transaction[],
  usdRate: number,
  todayStr: string
): PnlPart | null {
  const liveToman = Number(asset.price_toman);
  if (Number.isFinite(liveToman) && liveToman > 0) {
    // Same rule as `calculateAssetStats` so value and P/L always agree.
    const liveUsd = Number(asset.price_usd) || (usdRate > 0 ? liveToman / usdRate : 0);
    return { toman: liveToman, usd: liveUsd };
  }
  const hist = effectivePriceAt(asset, todayStr, dailyPrices, todayStr, transactions);
  return hist ? { toman: hist.priceToman, usd: hist.priceUsd } : null;
}

export function computeAssetPnl(
  asset: Asset,
  transactions: Transaction[],
  dailyPrices: DailyPrice[],
  usdRate: number,
  todayStr: string
): AssetPnl {
  const stats = calculateAssetStats(asset, transactions, 'TOMAN', usdRate);
  const included = asset.include_in_profit_loss !== false;
  const holdings = stats.totalAmount;

  // ── Active + all-time (lifetime replay) ────────────────────────────────
  const mark = holdings > 0 ? markPrice(asset, dailyPrices, transactions, usdRate, todayStr) : null;
  const activeAvailable = holdings <= 0 || mark !== null;
  const activeValue: PnlPart =
    holdings > 0 && mark
      ? {
          toman: holdings * mark.toman - stats.totalCostToman,
          usd: holdings * mark.usd - stats.totalCostUsd,
        }
      : { toman: 0, usd: 0 };

  const rawRealized: PnlPart = included
    ? { toman: stats.realizedProfitToman, usd: stats.realizedProfitUsd }
    : { toman: 0, usd: 0 };

  // ── Year (period replay with opening prices) ───────────────────────────
  const ytd = ytdUnrealizedForAsset(asset, transactions, dailyPrices, usdRate, todayStr);
  const yearRealized: PnlPart = { toman: ytd.realizedToman, usd: ytd.realizedUsd };
  const yearOpen: PnlPart = ytd.periodUnrealizedAvailable
    ? { toman: ytd.periodUnrealizedToman, usd: ytd.periodUnrealizedUsd }
    : { toman: 0, usd: 0 };
  // % base = capital at work in the year: opening units at the opening price
  // plus every buy made during the year.
  const yearBase: PnlPart = {
    toman: ytd.startHoldings * (ytd.periodStartPriceToman ?? 0) + ytd.bought.totalToman,
    usd: ytd.startHoldings * (ytd.periodStartPriceUsd ?? 0) + ytd.bought.totalUsd,
  };
  const yearEmpty = !ytd.hadActivity && ytd.startHoldings <= 0 && ytd.currentHoldings <= 0;

  return {
    included,
    holdings,
    active: {
      value: included ? activeValue : { toman: 0, usd: 0 },
      cost: { toman: stats.totalCostToman, usd: stats.totalCostUsd },
      since: stats.activeSinceDate,
      available: activeAvailable,
    },
    year: {
      value: included
        ? {
            toman: yearRealized.toman + yearOpen.toman,
            usd: yearRealized.usd + yearOpen.usd,
          }
        : { toman: 0, usd: 0 },
      realized: included ? yearRealized : { toman: 0, usd: 0 },
      open: included ? yearOpen : { toman: 0, usd: 0 },
      base: yearBase,
      partial: included && (!ytd.periodUnrealizedAvailable || ytd.periodBaselineMissing),
      empty: yearEmpty,
    },
    allTime: {
      value: included
        ? {
            toman: rawRealized.toman + activeValue.toman,
            usd: rawRealized.usd + activeValue.usd,
          }
        : { toman: 0, usd: 0 },
      realized: rawRealized,
      open: included ? activeValue : { toman: 0, usd: 0 },
      invested: { toman: stats.investedToman, usd: stats.investedUsd },
    },
  };
}
