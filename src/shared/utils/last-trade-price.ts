import type { Transaction } from '@/shared/types/domain';

/** True when `tx` moves units of `assetId` (either side, legacy or polymorphic). */
function txTouchesAsset(tx: Transaction, assetId: string): boolean {
  return (
    tx.asset_id === assetId ||
    tx.source_asset_id === assetId ||
    tx.target_asset_id === assetId
  );
}

/**
 * Unit price of the newest priced transaction of `assetId` on/before
 * `targetDate` (same date → the one created last). Needs `price_toman` and a
 * USD rate (or a USD snapshot) so both currencies are exact.
 * Pass `targetDate = null` for "newest ever".
 */
export function latestTradePriceAt(
  assetId: string,
  targetDate: string | null,
  transactions: Transaction[]
): { date: string; priceToman: number; priceUsd: number } | null {
  let best: { date: string; createdAt: string; priceToman: number; priceUsd: number } | null =
    null;
  for (const tx of transactions) {
    if (!txTouchesAsset(tx, assetId)) continue;
    const date = tx.date_string;
    if (!date || (targetDate !== null && date > targetDate)) continue;
    const priceToman = Number(tx.price_toman);
    if (!Number.isFinite(priceToman) || priceToman <= 0) continue;
    const rate = Number(tx.usd_rate);
    let priceUsd = Number.isFinite(rate) && rate > 0 ? priceToman / rate : NaN;
    if (!(priceUsd > 0)) {
      const qty = Number(tx.amount);
      const usdTotal = Number(tx.amount_usd_at_time);
      priceUsd = qty > 0 && usdTotal > 0 ? usdTotal / qty : NaN;
    }
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) continue;
    const createdAt = tx.created_at ?? '';
    if (
      !best ||
      date > best.date ||
      (date === best.date && createdAt > best.createdAt)
    ) {
      best = { date, createdAt, priceToman, priceUsd };
    }
  }
  return best
    ? { date: best.date, priceToman: best.priceToman, priceUsd: best.priceUsd }
    : null;
}
