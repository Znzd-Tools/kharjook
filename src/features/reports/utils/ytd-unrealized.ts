import type { Asset, CurrencyMode, DailyPrice, Transaction } from '@/shared/types/domain';
import {
  calculateAssetPeriodStats,
  type AssetPeriodStats,
} from '@/features/reports/utils/asset-period-stats';
import { effectivePriceAt } from '@/features/reports/utils/price-history';
import { formatJalaali } from '@/shared/utils/jalali';
import {
  clampPeriodToToday,
  currentPeriod,
  type Period,
} from '@/shared/utils/period';

export interface AssetYtdUnrealizedRow {
  asset: Asset;
  stats: AssetPeriodStats;
}

export interface YtdUnrealizedSummary {
  period: Period;
  rows: AssetYtdUnrealizedRow[];
  /** Total YTD P/L (realized + open when available). */
  totalToman: number;
  totalUsd: number;
  totalRealizedToman: number;
  totalRealizedUsd: number;
  totalOpenToman: number;
  totalOpenUsd: number;
  /** Assets with YTD activity where open P/L could not be included in the total. */
  partialTotalCount: number;
  missingStartPriceCount: number;
  missingEndPriceCount: number;
}

export interface YtdPnlDisplay {
  total: number | null;
  realized: number;
  open: number | null;
  /** Open portion missing; total may be realized-only. */
  isPartial: boolean;
  unavailable: boolean;
}

export function ytdPnlDisplay(
  stats: AssetPeriodStats,
  currencyMode: CurrencyMode
): YtdPnlDisplay {
  const realized =
    currencyMode === 'USD' ? stats.realizedUsd : stats.realizedToman;
  const open = stats.periodUnrealizedAvailable
    ? currencyMode === 'USD'
      ? stats.periodUnrealizedUsd
      : stats.periodUnrealizedToman
    : null;

  if (stats.periodUnrealizedAvailable) {
    return {
      total: realized + open!,
      realized,
      open,
      isPartial: false,
      unavailable: false,
    };
  }

  if (stats.hadActivity) {
    return {
      total: realized,
      realized,
      open: null,
      isPartial: stats.currentHoldings > 0,
      unavailable: false,
    };
  }

  return {
    total: null,
    realized,
    open: null,
    isPartial: stats.currentHoldings > 0,
    unavailable: true,
  };
}

export function currentJalaliYearPeriod(): Period {
  return clampPeriodToToday(currentPeriod('year'));
}

/**
 * Per-asset current-Jalali-year P/L (realized + open) and portfolio totals.
 * Assets with `include_in_profit_loss === false` are excluded.
 */
export function computeYtdUnrealizedSummary(
  assets: Asset[],
  transactions: Transaction[],
  dailyPrices: DailyPrice[],
  usdRate: number,
  todayStr: string
): YtdUnrealizedSummary {
  const period = currentJalaliYearPeriod();
  const startStr = formatJalaali(period.start);
  const endStr = formatJalaali(period.end);

  const rows: AssetYtdUnrealizedRow[] = [];
  let totalToman = 0;
  let totalUsd = 0;
  let totalRealizedToman = 0;
  let totalRealizedUsd = 0;
  let totalOpenToman = 0;
  let totalOpenUsd = 0;
  let partialTotalCount = 0;
  let missingStartPriceCount = 0;
  let missingEndPriceCount = 0;

  for (const asset of assets) {
    if (asset.include_in_profit_loss === false) continue;

    const startPrice = effectivePriceAt(asset, startStr, dailyPrices, todayStr);
    const endPrice = effectivePriceAt(asset, endStr, dailyPrices, todayStr);
    const stats = calculateAssetPeriodStats(
      asset,
      transactions,
      period,
      usdRate,
      endPrice,
      startPrice
    );

    rows.push({ asset, stats });

    if (stats.startHoldings > 0 && !startPrice) {
      missingStartPriceCount += 1;
    }
    if (stats.currentHoldings > 0 && !endPrice) {
      missingEndPriceCount += 1;
    }

    totalRealizedToman += stats.realizedToman;
    totalRealizedUsd += stats.realizedUsd;

    if (stats.periodUnrealizedAvailable) {
      totalOpenToman += stats.periodUnrealizedToman;
      totalOpenUsd += stats.periodUnrealizedUsd;
      totalToman += stats.realizedToman + stats.periodUnrealizedToman;
      totalUsd += stats.realizedUsd + stats.periodUnrealizedUsd;
    } else if (stats.hadActivity) {
      totalToman += stats.realizedToman;
      totalUsd += stats.realizedUsd;
      if (stats.currentHoldings > 0) partialTotalCount += 1;
    }
  }

  return {
    period,
    rows,
    totalToman,
    totalUsd,
    totalRealizedToman,
    totalRealizedUsd,
    totalOpenToman,
    totalOpenUsd,
    partialTotalCount,
    missingStartPriceCount,
    missingEndPriceCount,
  };
}

export function ytdUnrealizedForAsset(
  asset: Asset,
  transactions: Transaction[],
  dailyPrices: DailyPrice[],
  usdRate: number,
  todayStr: string
): AssetPeriodStats {
  const period = currentJalaliYearPeriod();
  const startStr = formatJalaali(period.start);
  const endStr = formatJalaali(period.end);
  const startPrice = effectivePriceAt(asset, startStr, dailyPrices, todayStr);
  const endPrice = effectivePriceAt(asset, endStr, dailyPrices, todayStr);
  return calculateAssetPeriodStats(
    asset,
    transactions,
    period,
    usdRate,
    endPrice,
    startPrice
  );
}
