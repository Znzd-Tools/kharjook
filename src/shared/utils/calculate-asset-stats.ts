import type { Asset, AssetStats, CurrencyMode, Transaction } from '@/shared/types/domain';
import { isClosedPosition } from '@/shared/utils/quantity-epsilon';
import { orderAssetTxsForReplay } from '@/shared/utils/asset-replay-order';
import { latestTradePriceAt } from '@/shared/utils/last-trade-price';
import { type RateHistory, usdHistoryFromTransactions } from '@/shared/utils/rate-history';

function resolvePriceUsd(
  tx: Transaction,
  amount: number,
  priceToman: number,
  usdRate: number,
  rateAtDate?: (date: string) => number | null
): number {
  const txUsdRate = Number(tx.usd_rate);
  if (Number.isFinite(txUsdRate) && txUsdRate > 0) {
    return priceToman / txUsdRate;
  }

  // Prefer point-in-time USD snapshot when available. This keeps USD P/L
  // independent from today’s FX drift on legacy/missing-rate rows.
  const snapshotUsd = Number(tx.amount_usd_at_time);
  if (Number.isFinite(snapshotUsd) && snapshotUsd > 0 && amount > 0) {
    return snapshotUsd / amount;
  }

  // No rate on the row: use the estimated rate of the row's date (history
  // from all transactions), and only then today's rate.
  const historical = rateAtDate ? rateAtDate(tx.date_string) : null;
  if (historical && historical > 0) return priceToman / historical;
  return usdRate > 0 ? priceToman / usdRate : 0;
}

export function calculateAssetStats(
  asset: Asset,
  transactions: Transaction[],
  currencyMode: CurrencyMode,
  usdRate: number
): AssetStats {
  const isAcquireType = (tx: Transaction) =>
    (tx.type === 'BUY' || tx.type === 'INCOME') &&
    (tx.asset_id === asset.id || tx.target_asset_id === asset.id);
  const isDisposeType = (tx: Transaction) =>
    (tx.type === 'SELL' || tx.type === 'EXPENSE') &&
    (tx.asset_id === asset.id || tx.source_asset_id === asset.id);
  const isTransferAcquire = (tx: Transaction) =>
    tx.type === 'TRANSFER' && tx.target_asset_id === asset.id;
  const isTransferDispose = (tx: Transaction) =>
    tx.type === 'TRANSFER' && tx.source_asset_id === asset.id;

  // Include transfer rows where the asset is one side. Payload writes
  // legacy trio (`asset_id/amount/price_toman`) for these rows.
  const assetTxs = transactions.filter(
    (tx) =>
      isAcquireType(tx) ||
      isDisposeType(tx) ||
      isTransferAcquire(tx) ||
      isTransferDispose(tx)
  );

  let totalAmount = 0;
  let totalCostToman = 0;
  let totalCostUsd = 0;
  let realizedProfitToman = 0;
  let realizedProfitUsd = 0;
  let historicalCostToman = 0;
  let historicalCostUsd = 0;
  let totalProceedsToman = 0;
  let totalProceedsUsd = 0;
  /** Date the current (still open) position started — last reset point. */
  let activeSinceDate: string | null = null;

  // Lazily built (only if some row lacks its own USD rate).
  let usdHistory: RateHistory | null = null;
  const usdAt = (date: string) => {
    usdHistory ??= usdHistoryFromTransactions(transactions);
    return usdHistory.at(date);
  };

  const isAcquireRow = (tx: Transaction) => isAcquireType(tx) || isTransferAcquire(tx);

  // Units this replay applies for a row (0 = the row is skipped below).
  // Legacy `amount` first; fall back to the polymorphic side that touches
  // this asset (same rule as `asset-period-stats`).
  const replayQty = (tx: Transaction): number => {
    const polyAmount = isAcquireRow(tx)
      ? tx.target_asset_id === asset.id
        ? tx.target_amount
        : null
      : tx.source_asset_id === asset.id
        ? tx.source_amount
        : null;
    const amount = Number(tx.amount ?? polyAmount);
    const priceToman = Number(tx.price_toman);
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    if (!Number.isFinite(priceToman) || priceToman <= 0) return 0;
    return amount;
  };

  // Date, then real creation order (so "sell all → buy again" on one day
  // closes the old position first); acquisitions-first only when the real
  // order would oversell.
  const sortedTxs = orderAssetTxsForReplay(assetTxs, isAcquireRow, replayQty);

  sortedTxs.forEach((tx) => {
    const isAcquire = isAcquireType(tx) || isTransferAcquire(tx);
    const isDispose = isDisposeType(tx) || isTransferDispose(tx);
    if (!isAcquire && !isDispose) return;

    const amount = replayQty(tx);
    if (!(amount > 0)) return;
    const priceToman = Number(tx.price_toman);
    const priceUsd = resolvePriceUsd(tx, amount, priceToman, usdRate, usdAt);

    if (isAcquire) {
      if (totalAmount <= 0) activeSinceDate = tx.date_string;
      totalAmount += amount;
      const txCostToman = amount * priceToman;
      totalCostToman += txCostToman;
      totalCostUsd += amount * priceUsd;
      historicalCostToman += txCostToman;
      historicalCostUsd += amount * priceUsd;
    } else {
      const unitsBefore = totalAmount;
      if (totalAmount > 0) {
        const avgCostToman = totalCostToman / totalAmount;
        const avgCostUsd = totalCostUsd / totalAmount;
        // Never realize P/L on units that were not held (oversell).
        const drain = Math.min(amount, totalAmount);

        totalProceedsToman += drain * priceToman;
        totalProceedsUsd += drain * priceUsd;

        // Calculate Realized Profit
        realizedProfitToman += drain * (priceToman - avgCostToman);
        realizedProfitUsd += drain * (priceUsd - avgCostUsd);

        // Reduce Cost Basis proportionately
        totalCostToman -= drain * avgCostToman;
        totalCostUsd -= drain * avgCostUsd;
        totalAmount -= drain;
      }

      // Position closed (only float noise left): reset quantity AND cost
      // basis, so the next buy starts a fresh "active" position.
      if (isClosedPosition(totalAmount, unitsBefore)) {
        totalAmount = 0;
        totalCostToman = 0;
        totalCostUsd = 0;
        activeSinceDate = null;
      }
    }
  });

  const avgBuyPriceToman = totalAmount > 0 ? totalCostToman / totalAmount : 0;
  const avgBuyPriceUsd = totalAmount > 0 ? totalCostUsd / totalAmount : 0;
  // Current price: the live cached price. When the asset has none (manual
  // asset never priced), use the newest BUY/SELL price instead of 0, so value
  // and P/L never show a false −100%.
  let currentPriceToman = Number(asset.price_toman) || 0;
  let currentPriceUsd =
    Number(asset.price_usd) || (usdRate > 0 ? currentPriceToman / usdRate : 0);
  let currentPriceSource: AssetStats['currentPriceSource'] =
    currentPriceToman > 0 ? 'live' : 'none';
  let currentPriceDate: string | null = null;
  if (!(currentPriceToman > 0)) {
    const last = latestTradePriceAt(asset.id, null, assetTxs);
    if (last) {
      currentPriceToman = last.priceToman;
      currentPriceUsd = last.priceUsd;
      currentPriceSource = 'trade';
      currentPriceDate = last.date;
    }
  }

  const currentValueToman = totalAmount * currentPriceToman;
  const currentValueUsd = totalAmount * currentPriceUsd;

  // Calculate Unrealized Profit (from remaining holdings)
  const unrealizedProfitToman = currentValueToman - totalCostToman;
  const unrealizedProfitUsd = currentValueUsd - totalCostUsd;

  // Total PNL = Realized (from sells) + Unrealized (from current bags)
  const profitLossToman = realizedProfitToman + unrealizedProfitToman;
  const profitLossUsd = realizedProfitUsd + unrealizedProfitUsd;

  const profitLossPercent =
    currencyMode === 'USD'
      ? historicalCostUsd > 0
        ? (profitLossUsd / historicalCostUsd) * 100
        : 0
      : historicalCostToman > 0
        ? (profitLossToman / historicalCostToman) * 100
        : 0;

  const includePnl = asset.include_in_profit_loss ?? true;

  return {
    totalAmount,
    totalCostToman,
    totalCostUsd,
    avgBuyPriceToman,
    avgBuyPriceUsd,
    currentValueToman,
    currentValueUsd,
    profitLossToman: includePnl ? profitLossToman : 0,
    profitLossUsd: includePnl ? profitLossUsd : 0,
    profitLossPercent: includePnl ? profitLossPercent : 0,
    realizedProfitToman: includePnl ? realizedProfitToman : 0,
    realizedProfitUsd: includePnl ? realizedProfitUsd : 0,
    unrealizedProfitToman: includePnl ? unrealizedProfitToman : 0,
    unrealizedProfitUsd: includePnl ? unrealizedProfitUsd : 0,
    investedToman: historicalCostToman,
    investedUsd: historicalCostUsd,
    proceedsToman: totalProceedsToman,
    proceedsUsd: totalProceedsUsd,
    activeSinceDate: totalAmount > 0 ? activeSinceDate : null,
    currentPriceToman,
    currentPriceUsd,
    currentPriceSource,
    currentPriceDate,
  };
}

/**
 * Net units on hand from a transaction list — the single quantity replay
 * used by the assets list, holdings checks and historical charts.
 * Pass a pre-filtered list (e.g. `date <= X`) for point-in-time holdings.
 */
export function assetQuantityFromTransactions(
  assetId: string,
  transactions: Transaction[]
): number {
  return calculateAssetStats(
    {
      id: assetId,
      user_id: '',
      category_id: null,
      name: '',
      unit: '',
      decimal_places: 4,
      price_toman: 0,
      price_usd: 0,
      icon_url: null,
      price_source_id: null,
      include_in_profit_loss: false,
    },
    transactions,
    'TOMAN',
    1
  ).totalAmount;
}
