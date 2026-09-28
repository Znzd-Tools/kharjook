import type { Asset, DailyPrice, Transaction } from '@/shared/types/domain';
import { addDays, formatJalaali, type JalaaliDate } from '@/shared/utils/jalali';
import { latestTradePriceAt } from '@/shared/utils/last-trade-price';

/**
 * Resolved price for an asset on a specific Jalali date.
 *
 *  - `isLive`    = true when the value came from the live `assets.price_*`
 *                  cache (i.e. target date is today or in the future).
 *  - `sourceDate` = the canonical Jalali "YYYY/MM/DD" the value was
 *                  recorded on. For live reads this equals `todayDate`.
 */
export interface EffectivePrice {
  priceToman: number;
  priceUsd: number;
  sourceDate: string;
  isLive: boolean;
}

/**
 * Resolve the effective price of `asset` as of `targetDate`, choosing
 * between the live cache (`assets.price_*`) and the historical snapshots
 * in `daily_prices` using the following strict rules:
 *
 *   targetDate >= todayDate:
 *     Return the live cache. This is the only source that can speak for
 *     today / the future and it's what every other screen in the app
 *     already uses.
 *
 *   targetDate <  todayDate:
 *     Look up the MAX `date_string` row for this asset with
 *     `date_string <= targetDate`. If none exists, return `null` — we
 *     refuse to invent a price. Callers MUST render an explicit
 *     "no data" state; silently falling back to the live cache would
 *     corrupt historical unrealized-P/L calculations (which was the
 *     entire reason this module exists).
 *
 * Canonical Jalali "YYYY/MM/DD" strings sort chronologically under
 * lexicographic comparison — relied on throughout.
 *
 * Zero / negative cache values are treated as "unset" and return null.
 *
 * This function is O(n) in `dailyPrices` length. For the typical user
 * with a few hundred snapshot rows this is fine; if it ever becomes
 * hot, pre-group by asset at call site.
 */
export function effectivePriceAt(
  asset: Asset,
  targetDate: string,
  dailyPrices: DailyPrice[],
  todayDate: string,
  /**
   * Optional: the user's transactions. When given, the unit price of every
   * BUY / SELL (and other priced asset row) is used as a historical price for
   * its date whenever no daily snapshot is newer. Snapshots win on the same
   * date (manual > trade > auto).
   */
  transactions?: Transaction[]
): EffectivePrice | null {
  if (targetDate >= todayDate) {
    const toman = Number(asset.price_toman);
    const usd = Number(asset.price_usd);
    if (Number.isFinite(toman) && toman > 0 && Number.isFinite(usd) && usd > 0) {
      return {
        priceToman: toman,
        priceUsd: usd,
        sourceDate: todayDate,
        isLive: true,
      };
    }
    // No live price cached: only fall back to history when the caller gave
    // us transactions (keeps the old strict behavior otherwise).
    if (!transactions) return null;
  }

  let best: DailyPrice | null = null;
  for (const p of dailyPrices) {
    if (p.asset_id !== asset.id) continue;
    if (p.date_string > targetDate) continue;
    if (!(Number(p.price_toman) > 0) || !(Number(p.price_usd) > 0)) continue;
    if (!best || p.date_string > best.date_string) best = p;
  }

  const trade = transactions ? latestTradePriceAt(asset.id, targetDate, transactions) : null;

  // The newest observation wins; on the same date the snapshot wins.
  if (trade && (!best || trade.date > best.date_string)) {
    return {
      priceToman: trade.priceToman,
      priceUsd: trade.priceUsd,
      sourceDate: trade.date,
      isLive: false,
    };
  }
  if (!best) return null;

  return {
    priceToman: Number(best.price_toman),
    priceUsd: Number(best.price_usd),
    sourceDate: best.date_string,
    isLive: false,
  };
}

export { latestTradePriceAt } from '@/shared/utils/last-trade-price';

/**
 * Opening price of a period = close of the day BEFORE `periodStart`.
 * Holdings carried into the period must be valued at the previous close;
 * using the first day's own close hid that day's move (and for a "today"
 * period it always used the live price, so opening P/L was always 0).
 * Falls back to `periodStart` itself when no earlier snapshot exists, so
 * nothing that had a price before loses it.
 */
export function effectiveOpeningPriceAt(
  asset: Asset,
  periodStart: JalaaliDate,
  dailyPrices: DailyPrice[],
  todayDate: string,
  transactions?: Transaction[]
): EffectivePrice | null {
  const dayBefore = formatJalaali(addDays(periodStart, -1));
  return (
    effectivePriceAt(asset, dayBefore, dailyPrices, todayDate, transactions) ??
    effectivePriceAt(asset, formatJalaali(periodStart), dailyPrices, todayDate, transactions)
  );
}
