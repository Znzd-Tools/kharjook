/**
 * Per-asset P/L for a Jalali period.
 *
 * Model:
 *  - Replay every asset-touching tx (BUY/SELL and asset-side
 *    INCOME/EXPENSE) in chronological order so the running average
 *    cost-basis reflects all prior activity — we can't compute
 *    realized P/L on period sells without the cost basis they drain.
 *  - Asset-side INCOME is treated as a BUY: new units enter the book
 *    at the user-provided `price_toman` (market at receipt). That's
 *    the only honest cost basis we can establish without separate
 *    "received-for-free" semantics.
 *  - Asset-side EXPENSE is treated as a SELL: units leave the book at
 *    the user-provided `price_toman`, realizing P/L against the
 *    running average cost (units × (price − avgCost)). Same math in
 *    USD using each tx's own `usd_rate`.
 *  - A SELL charges against the running average cost; realized P/L
 *    = units sold × (sell price − avg cost). Same math in USD using each
 *    tx's own `usd_rate` (falling back to today's rate only if missing).
 *  - Avg buy/sell *for the period* is quantity-weighted over txs dated
 *    inside the period. INCOME rolls into `bought`; EXPENSE into `sold`.
 *  - Period unrealized P/L = mark-to-market of holdings at period end
 *    minus the remaining period baseline. Opening holdings (units held
 *    before `period.start`) enter the baseline at `periodStartPrice`,
 *    not lifetime cost. In-period buys add at tx cost; in-period sells
 *    drain the baseline pool by average cost.
 *  - Absolute open P/L at period end (`unrealizedToman`) is kept for
 *    reference: endHoldings × endPrice − endCostBasis (lifetime basis
 *    snapshot at period end).
 */

import type { Asset, Transaction } from '@/shared/types/domain';
import { parseDateToNumber } from '@/shared/utils/parse-date';
import { isInPeriod, jalaaliToNumber, type Period } from '@/shared/utils/period';
import type { EffectivePrice } from './price-history';

export interface SideAggregate {
  units: number;
  totalToman: number;
  totalUsd: number;
  avgPriceToman: number; // qty-weighted average within the period
  avgPriceUsd: number;
  count: number;
}

export interface AssetPeriodStats {
  assetId: string;
  bought: SideAggregate;
  sold: SideAggregate;
  realizedToman: number; // booked from period SELLs only
  realizedUsd: number;
  /** Units held immediately before the first in-period tx (or at period start). */
  startHoldings: number;
  /** Holdings + cost basis at the end of the period. */
  endHoldings: number;
  endCostBasisToman: number;
  endCostBasisUsd: number;
  endAvgCostToman: number;
  endAvgCostUsd: number;
  /** Holdings + cost basis right now (= after replaying every tx). */
  currentHoldings: number;
  currentCostBasisToman: number;
  currentCostBasisUsd: number;
  currentAvgCostToman: number;
  currentAvgCostUsd: number;
  /**
   * True period unrealized P/L: evalHoldings × price-at-period-end
   * minus remaining period baseline (opening @ start price + in-period
   * buys, net of in-period sells).
   *
   * Unavailable when opening holdings existed at period start but no
   * start price was supplied, or when eval holdings are non-zero and
   * no end price exists.
   */
  periodUnrealizedToman: number;
  periodUnrealizedUsd: number;
  periodUnrealizedAvailable: boolean;
  /**
   * Absolute open P/L at period end using lifetime cost basis snapshot:
   * endHoldings × price-at-period-end − endCostBasis.
   */
  unrealizedToman: number;
  unrealizedUsd: number;
  unrealizedAvailable: boolean;
  /** The price used for the mark (null if unavailable / no holdings). */
  periodEndPriceToman: number | null;
  periodEndPriceUsd: number | null;
  /** Date the snapshot was actually taken on; null when using live cache or no price. */
  periodEndPriceSourceDate: string | null;
  periodEndPriceIsLive: boolean;
  hadActivity: boolean;
  /** Asset-touching rows skipped because price/amount/rate was invalid. */
  invalidTradeCount: number;
  /** Number of sells/asset-expenses that exceeded available holdings. */
  oversellCount: number;
}

function emptySide(): SideAggregate {
  return {
    units: 0,
    totalToman: 0,
    totalUsd: 0,
    avgPriceToman: 0,
    avgPriceUsd: 0,
    count: 0,
  };
}

export function emptyAssetPeriodStats(assetId: string): AssetPeriodStats {
  return {
    assetId,
    bought: emptySide(),
    sold: emptySide(),
    realizedToman: 0,
    realizedUsd: 0,
    startHoldings: 0,
    endHoldings: 0,
    endCostBasisToman: 0,
    endCostBasisUsd: 0,
    endAvgCostToman: 0,
    endAvgCostUsd: 0,
    currentHoldings: 0,
    currentCostBasisToman: 0,
    currentCostBasisUsd: 0,
    currentAvgCostToman: 0,
    currentAvgCostUsd: 0,
    periodUnrealizedToman: 0,
    periodUnrealizedUsd: 0,
    periodUnrealizedAvailable: true,
    unrealizedToman: 0,
    unrealizedUsd: 0,
    unrealizedAvailable: true,
    periodEndPriceToman: null,
    periodEndPriceUsd: null,
    periodEndPriceSourceDate: null,
    periodEndPriceIsLive: false,
    hadActivity: false,
    invalidTradeCount: 0,
    oversellCount: 0,
  };
}

function finalizeSide(s: SideAggregate): void {
  s.avgPriceToman = s.units > 0 ? s.totalToman / s.units : 0;
  s.avgPriceUsd = s.units > 0 ? s.totalUsd / s.units : 0;
}

/**
 * Normalize the cost-basis / proceeds side of any asset-touching tx into
 * unified `(amount, priceToman, priceUsd)`. Handles:
 *   - BUY / SELL / TRANSFER (legacy + polymorphic columns)
 *   - Asset-side INCOME (target_asset_id populated)
 *   - Asset-side EXPENSE (source_asset_id populated)
 *
 * For new asset-side INCOME/EXPENSE, `buildPayload` also fills the
 * legacy `amount`, `price_toman`, `usd_rate` columns so this function
 * doesn't need type-specific branching. If either value is missing or
 * non-positive, we return null and the caller skips the row — a silent
 * drop is preferable to fabricating numbers.
 */
function readTrade(
  tx: Transaction,
  usdRateFallback: number
): { amount: number; priceToman: number; priceUsd: number } | null {
  const polyAmount =
    tx.type === 'BUY' || tx.type === 'INCOME'
      ? tx.target_amount
      : tx.source_amount;
  const amount = Number(tx.amount ?? polyAmount);

  let priceToman = Number(tx.price_toman);
  if (!Number.isFinite(priceToman) || priceToman <= 0) {
    // Only BUY/SELL can derive priceToman from the counterparty wallet
    // amount. TRANSFER/INCOME/EXPENSE must carry `price_toman`.
    if (tx.type === 'BUY' || tx.type === 'SELL') {
      const money = Number(tx.type === 'BUY' ? tx.source_amount : tx.target_amount);
      if (Number.isFinite(money) && money > 0 && Number.isFinite(amount) && amount > 0) {
        priceToman = money / amount;
      }
    }
  }
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!Number.isFinite(priceToman) || priceToman <= 0) return null;
  const rate = Number(tx.usd_rate) > 0 ? Number(tx.usd_rate) : usdRateFallback;
  if (!(rate > 0)) return null;
  return { amount, priceToman, priceUsd: priceToman / rate };
}

/**
 * True when a tx adds units to the asset's book (BUY or asset-side
 * INCOME with the asset as target). Asset-side INCOME from `buildPayload`
 * also writes `asset_id` = target.
 */
function isAcquireForAsset(tx: Transaction, assetId: string): boolean {
  if (tx.type === 'BUY') {
    return tx.asset_id === assetId || tx.target_asset_id === assetId;
  }
  if (tx.type === 'INCOME') {
    return tx.target_asset_id === assetId || tx.asset_id === assetId;
  }
  if (tx.type === 'TRANSFER') {
    return tx.target_asset_id === assetId;
  }
  return false;
}

function isDisposeForAsset(tx: Transaction, assetId: string): boolean {
  if (tx.type === 'SELL') {
    return tx.asset_id === assetId || tx.source_asset_id === assetId;
  }
  if (tx.type === 'EXPENSE') {
    return tx.source_asset_id === assetId || tx.asset_id === assetId;
  }
  if (tx.type === 'TRANSFER') {
    return tx.source_asset_id === assetId;
  }
  return false;
}

function drainPeriodPool(
  poolUnits: number,
  poolCostToman: number,
  poolCostUsd: number,
  drainAmount: number
): { units: number; costToman: number; costUsd: number } {
  if (drainAmount <= 0 || poolUnits <= 0) {
    return { units: poolUnits, costToman: poolCostToman, costUsd: poolCostUsd };
  }
  const avgT = poolCostToman / poolUnits;
  const avgU = poolCostUsd / poolUnits;
  const drain = Math.min(drainAmount, poolUnits);
  let units = poolUnits - drain;
  let costToman = poolCostToman - drain * avgT;
  let costUsd = poolCostUsd - drain * avgU;
  if (units <= 1e-6) {
    units = 0;
    costToman = 0;
    costUsd = 0;
  }
  return { units, costToman, costUsd };
}

export function calculateAssetPeriodStats(
  asset: Asset,
  transactions: Transaction[],
  period: Period,
  usdRateFallback: number,
  /**
   * Price of the asset AT THE END OF `period`, resolved by the caller
   * via `effectivePriceAt`. Pass `null` when no snapshot exists — we
   * will flag `periodUnrealizedAvailable = false` unless holdings are
   * flat at evaluation.
   */
  periodEndPrice: EffectivePrice | null,
  /**
   * Price at `period.start` for valuing opening holdings. Required when
   * `startHoldings > 0`. Pass `null` only when opening holdings are zero
   * or period kind is `all` (no pre-period baseline).
   */
  periodStartPrice: EffectivePrice | null = null
): AssetPeriodStats {
  if (asset.include_in_profit_loss === false) {
    return emptyAssetPeriodStats(asset.id);
  }

  const assetTxs = transactions.filter((tx) => {
    if (isAcquireForAsset(tx, asset.id)) return true;
    if (isDisposeForAsset(tx, asset.id)) return true;
    return false;
  });

  const acquireRank = (tx: Transaction) =>
    isAcquireForAsset(tx, asset.id) ? 0 : 1;

  const sorted = [...assetTxs].sort((a, b) => {
    const da = parseDateToNumber(a.date_string);
    const db = parseDateToNumber(b.date_string);
    if (da !== db) return da - db;
    const ra = acquireRank(a);
    const rb = acquireRank(b);
    if (ra !== rb) return ra - rb;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const stats = emptyAssetPeriodStats(asset.id);
  const startNum = jalaaliToNumber(period.start);
  const endNum = jalaaliToNumber(period.end);

  let units = 0;
  let costToman = 0;
  let costUsd = 0;

  let endUnits = 0;
  let endCostToman = 0;
  let endCostUsd = 0;
  let endSnapshotted = false;

  let periodPoolUnits = 0;
  let periodPoolCostToman = 0;
  let periodPoolCostUsd = 0;
  let periodPoolInitialized = false;
  let missingStartPrice = false;

  const initPeriodPool = () => {
    if (periodPoolInitialized) return;
    periodPoolInitialized = true;
    stats.startHoldings = units;
    if (units <= 0) return;
    if (periodStartPrice) {
      periodPoolUnits = units;
      periodPoolCostToman = units * periodStartPrice.priceToman;
      periodPoolCostUsd = units * periodStartPrice.priceUsd;
    } else {
      missingStartPrice = true;
    }
  };

  for (const tx of sorted) {
    const trade = readTrade(tx, usdRateFallback);
    if (!trade) {
      stats.invalidTradeCount += 1;
      continue;
    }
    const { amount, priceToman, priceUsd } = trade;

    const txNum = parseDateToNumber(tx.date_string);
    if (txNum >= startNum) {
      initPeriodPool();
    }

    if (!endSnapshotted && txNum > endNum) {
      endUnits = units;
      endCostToman = costToman;
      endCostUsd = costUsd;
      endSnapshotted = true;
    }

    const inPeriod = isInPeriod(tx.date_string, period);
    const isAcquire = isAcquireForAsset(tx, asset.id);

    if (isAcquire) {
      units += amount;
      costToman += amount * priceToman;
      costUsd += amount * priceUsd;

      if (inPeriod) {
        initPeriodPool();
        periodPoolUnits += amount;
        periodPoolCostToman += amount * priceToman;
        periodPoolCostUsd += amount * priceUsd;
        stats.bought.units += amount;
        stats.bought.totalToman += amount * priceToman;
        stats.bought.totalUsd += amount * priceUsd;
        stats.bought.count += 1;
        stats.hadActivity = true;
      }
    } else {
      const avgT = units > 0 ? costToman / units : 0;
      const avgU = units > 0 ? costUsd / units : 0;
      const drain = Math.min(amount, units);
      if (amount > units + 1e-6) stats.oversellCount += 1;

      if (inPeriod) {
        initPeriodPool();
        stats.realizedToman += drain * (priceToman - avgT);
        stats.realizedUsd += drain * (priceUsd - avgU);
        stats.sold.units += amount;
        stats.sold.totalToman += amount * priceToman;
        stats.sold.totalUsd += amount * priceUsd;
        stats.sold.count += 1;
        stats.hadActivity = true;

        const drained = drainPeriodPool(
          periodPoolUnits,
          periodPoolCostToman,
          periodPoolCostUsd,
          drain
        );
        periodPoolUnits = drained.units;
        periodPoolCostToman = drained.costToman;
        periodPoolCostUsd = drained.costUsd;
      }

      units -= drain;
      costToman -= drain * avgT;
      costUsd -= drain * avgU;

      if (units <= 1e-6) {
        units = 0;
        costToman = 0;
        costUsd = 0;
      }
    }
  }

  if (!periodPoolInitialized) {
    initPeriodPool();
  }

  if (!endSnapshotted) {
    endUnits = units;
    endCostToman = costToman;
    endCostUsd = costUsd;
  }

  stats.endHoldings = endUnits;
  stats.endCostBasisToman = endCostToman;
  stats.endCostBasisUsd = endCostUsd;
  stats.endAvgCostToman = endUnits > 0 ? endCostToman / endUnits : 0;
  stats.endAvgCostUsd = endUnits > 0 ? endCostUsd / endUnits : 0;

  stats.currentHoldings = units;
  stats.currentCostBasisToman = costToman;
  stats.currentCostBasisUsd = costUsd;
  stats.currentAvgCostToman = units > 0 ? costToman / units : 0;
  stats.currentAvgCostUsd = units > 0 ? costUsd / units : 0;

  const evalHoldings = units;
  const evalPoolCostToman = periodPoolCostToman;
  const evalPoolCostUsd = periodPoolCostUsd;

  // Absolute open P/L at period-end holdings snapshot (lifetime cost basis).
  if (endUnits <= 0) {
    stats.unrealizedAvailable = true;
    stats.unrealizedToman = 0;
    stats.unrealizedUsd = 0;
  } else if (periodEndPrice) {
    stats.unrealizedAvailable = true;
    stats.unrealizedToman = endUnits * periodEndPrice.priceToman - endCostToman;
    stats.unrealizedUsd = endUnits * periodEndPrice.priceUsd - endCostUsd;
    stats.periodEndPriceToman = periodEndPrice.priceToman;
    stats.periodEndPriceUsd = periodEndPrice.priceUsd;
    stats.periodEndPriceSourceDate = periodEndPrice.isLive
      ? null
      : periodEndPrice.sourceDate;
    stats.periodEndPriceIsLive = periodEndPrice.isLive;
  } else {
    stats.unrealizedAvailable = false;
  }

  // True period unrealized at evaluation (current holdings for live periods).
  if (evalHoldings <= 0) {
    stats.periodUnrealizedAvailable = true;
    stats.periodUnrealizedToman = 0;
    stats.periodUnrealizedUsd = 0;
  } else if (missingStartPrice) {
    stats.periodUnrealizedAvailable = false;
  } else if (periodEndPrice) {
    stats.periodUnrealizedAvailable = true;
    stats.periodUnrealizedToman =
      evalHoldings * periodEndPrice.priceToman - evalPoolCostToman;
    stats.periodUnrealizedUsd =
      evalHoldings * periodEndPrice.priceUsd - evalPoolCostUsd;
    if (stats.periodEndPriceToman === null) {
      stats.periodEndPriceToman = periodEndPrice.priceToman;
      stats.periodEndPriceUsd = periodEndPrice.priceUsd;
      stats.periodEndPriceSourceDate = periodEndPrice.isLive
        ? null
        : periodEndPrice.sourceDate;
      stats.periodEndPriceIsLive = periodEndPrice.isLive;
    }
  } else {
    stats.periodUnrealizedAvailable = false;
  }

  finalizeSide(stats.bought);
  finalizeSide(stats.sold);

  return stats;
}
