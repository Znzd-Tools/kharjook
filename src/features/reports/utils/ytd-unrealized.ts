import type { Asset, DailyPrice, Transaction } from '@/shared/types/domain';
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
  totalToman: number;
  totalUsd: number;
  missingStartPriceCount: number;
  missingEndPriceCount: number;
}

export function currentJalaliYearPeriod(): Period {
  return clampPeriodToToday(currentPeriod('year'));
}

/**
 * Per-asset true current-Jalali-year unrealized P/L and portfolio totals.
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

    if (stats.periodUnrealizedAvailable) {
      totalToman += stats.periodUnrealizedToman;
      totalUsd += stats.periodUnrealizedUsd;
    }
  }

  return {
    period,
    rows,
    totalToman,
    totalUsd,
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
