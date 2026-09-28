/**
 * Historical currency rates (Toman per 1 unit) rebuilt from data the app
 * already has, for every date — including dates with no recorded rate.
 *
 * Why: the Toman/USD rate moves a lot. Converting a past row with TODAY's
 * rate rewrites history. When a row has no rate of its own, we estimate the
 * rate of ITS date instead.
 *
 * Observations (best source first; on one date only the best tier counts,
 * and the median of that tier is used):
 *   0  saved history rows (`currency_rate_history`: manual / provider)
 *   1  current saved rate (`currency_rates`) on the day it was last updated
 *   2  daily price snapshots (manual / auto): price_toman ÷ price_usd
 *   3  BUY / SELL / TRANSFER rows entered within 3 days of their date
 *   4  INCOME / EXPENSE snapshots entered within 3 days of their date
 *   5  BUY / SELL / TRANSFER rows entered later (user typed the rate)
 * INCOME / EXPENSE rows entered later are ignored: their rate was auto-filled
 * with the rate of the entry day, not of the transaction date.
 *
 * Estimation for a date:
 *   - exact observation → that value
 *   - between two observations → straight line between them (by day count)
 *   - before the first / after the last → the nearest observation (flat)
 * Typos are dropped: a value that is less than half or more than double the
 * median of its neighbours (±30 days) is ignored.
 */

import * as j from 'jalaali-js';
import type {
  CurrencyRate,
  DailyPrice,
  RateCurrency,
  Transaction,
  Wallet,
} from '@/shared/types/domain';
import { parseJalaali } from '@/shared/utils/jalali';

export interface RatePoint {
  day: number; // days since 1970-01-01 (UTC)
  date: string; // canonical Jalali YYYY/MM/DD
  rate: number;
}

export interface RateHistory {
  /** Estimated Toman per unit on `date` (Jalali). null = no data at all. */
  at(date: string): number | null;
  /** Newest known rate (null = no data). */
  latest(): number | null;
  points: RatePoint[];
}

export interface RateHistoryRow {
  currency: RateCurrency;
  date_string: string;
  toman_per_unit: number;
}

interface Observation {
  day: number;
  date: string;
  rate: number;
  tier: number;
}

const DAY_MS = 86_400_000;
const LATE_ENTRY_DAYS = 3;
const OUTLIER_WINDOW_DAYS = 30;

/** Jalali date string → UTC day number; null when invalid. */
export function jalaliDayNumber(date: string): number | null {
  const p = parseJalaali(date);
  if (!p) return null;
  const g = j.toGregorian(p.jy, p.jm, p.jd);
  return Math.floor(Date.UTC(g.gy, g.gm - 1, g.gd) / DAY_MS);
}

function canonical(date: string): string | null {
  const p = parseJalaali(date);
  if (!p) return null;
  return `${p.jy}/${String(p.jm).padStart(2, '0')}/${String(p.jd).padStart(2, '0')}`;
}

function isoDayNumber(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return null;
  // Tehran is UTC+3:30; shift so the local calendar day is used.
  return Math.floor((ms + 3.5 * 3_600_000) / DAY_MS);
}

function jalaliFromIso(iso: string | null | undefined): string | null {
  const day = isoDayNumber(iso);
  if (day === null) return null;
  const d = new Date(day * DAY_MS);
  const jd = j.toJalaali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  return `${jd.jy}/${String(jd.jm).padStart(2, '0')}/${String(jd.jd).padStart(2, '0')}`;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Build a history from raw observations (tiering, typo filter, per-day median). */
function historyFromObservations(obs: Observation[]): RateHistory {
  // 1) Best tier per day.
  const byDay = new Map<number, Observation[]>();
  for (const o of obs) {
    if (!(o.rate > 0) || !Number.isFinite(o.rate)) continue;
    const list = byDay.get(o.day);
    if (!list) byDay.set(o.day, [o]);
    else list.push(o);
  }
  let points: RatePoint[] = [];
  for (const [day, list] of byDay) {
    const best = Math.min(...list.map((o) => o.tier));
    const chosen = list.filter((o) => o.tier === best);
    points.push({ day, date: chosen[0]!.date, rate: median(chosen.map((o) => o.rate)) });
  }
  points.sort((a, b) => a.day - b.day);

  // 2) Drop typos against the median of neighbours (needs ≥ 3 neighbours).
  //    Points are sorted, so the ±window is a sliding range (no O(n²) scan).
  if (points.length >= 4) {
    const src = points;
    const keep: RatePoint[] = [];
    let lo = 0;
    let hi = 0;
    for (let idx = 0; idx < src.length; idx += 1) {
      const p = src[idx]!;
      while (src[lo]!.day < p.day - OUTLIER_WINDOW_DAYS) lo += 1;
      while (hi + 1 < src.length && src[hi + 1]!.day <= p.day + OUTLIER_WINDOW_DAYS) hi += 1;
      const neighbours: number[] = [];
      for (let k = lo; k <= hi; k += 1) if (k !== idx) neighbours.push(src[k]!.rate);
      if (neighbours.length < 3) {
        keep.push(p);
        continue;
      }
      const m = median(neighbours);
      if (p.rate >= m / 2 && p.rate <= m * 2) keep.push(p);
    }
    points = keep;
  }

  const at = (date: string): number | null => {
    if (points.length === 0) return null;
    const day = jalaliDayNumber(date);
    if (day === null) return points[points.length - 1]!.rate;
    if (day <= points[0]!.day) return points[0]!.rate;
    const last = points[points.length - 1]!;
    if (day >= last.day) return last.rate;
    // Binary search for the first point with day >= target.
    let lo = 0;
    let hi = points.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (points[mid]!.day < day) lo = mid + 1;
      else hi = mid;
    }
    const next = points[lo]!;
    if (next.day === day) return next.rate;
    const prev = points[lo - 1]!;
    const t = (day - prev.day) / (next.day - prev.day);
    return prev.rate + (next.rate - prev.rate) * t;
  };

  return {
    at,
    latest: () => (points.length ? points[points.length - 1]!.rate : null),
    points,
  };
}

function isLateEntry(tx: Transaction, txDay: number): boolean {
  const created = isoDayNumber(tx.created_at);
  if (created === null) return false;
  return created - txDay > LATE_ENTRY_DAYS;
}

function hasAssetLeg(tx: Transaction): boolean {
  return !!(tx.asset_id || tx.source_asset_id || tx.target_asset_id);
}

export interface RateHistorySources {
  transactions: Transaction[];
  dailyPrices?: DailyPrice[];
  currencyRates?: CurrencyRate[];
  wallets?: Wallet[];
  savedHistory?: RateHistoryRow[];
}

/** Collect observations for every rate currency from the app data. */
export function collectRateObservations(
  src: RateHistorySources
): Record<RateCurrency, Observation[]> {
  const out: Record<RateCurrency, Observation[]> = { USD: [], TRY: [], EUR: [] };
  const push = (currency: RateCurrency, date: string, rate: number, tier: number) => {
    const c = canonical(date);
    if (!c || !(rate > 0) || !Number.isFinite(rate)) return;
    const day = jalaliDayNumber(c);
    if (day === null) return;
    out[currency].push({ day, date: c, rate, tier });
  };

  for (const row of src.savedHistory ?? []) {
    if (out[row.currency]) push(row.currency, row.date_string, Number(row.toman_per_unit), 0);
  }

  for (const r of src.currencyRates ?? []) {
    const date = jalaliFromIso(r.updated_at);
    if (date && out[r.currency]) push(r.currency, date, Number(r.toman_per_unit), 1);
  }

  for (const p of src.dailyPrices ?? []) {
    // `trade` snapshots repeat the rate of their transaction (counted below).
    if (p.source === 'trade') continue;
    const toman = Number(p.price_toman);
    const usd = Number(p.price_usd);
    if (toman > 0 && usd > 0) push('USD', p.date_string, toman / usd, 2);
  }

  const walletById = new Map((src.wallets ?? []).map((w) => [w.id, w]));
  for (const tx of src.transactions) {
    const day = jalaliDayNumber(tx.date_string);
    if (day === null) continue;
    const late = isLateEntry(tx, day);
    const isTrade = tx.type === 'BUY' || tx.type === 'SELL' || tx.type === 'TRANSFER';
    if (!isTrade && late) continue; // auto-filled with the entry day's rate
    const tier = isTrade ? (late ? 5 : 3) : 4;

    // USD: explicit rate, else toman ÷ usd snapshot.
    const usdRate = Number(tx.usd_rate);
    if (usdRate > 0) {
      push('USD', tx.date_string, usdRate, tier);
    } else {
      const t = Number(tx.amount_toman_at_time);
      const u = Number(tx.amount_usd_at_time);
      if (t > 0 && u > 0) push('USD', tx.date_string, t / u, tier);
    }

    // Wallet currencies: non-IRT wallet rows store Toman-per-unit in
    // `price_toman` when no asset is involved.
    if (!hasAssetLeg(tx)) {
      const wallet =
        walletById.get(tx.source_wallet_id ?? '') ?? walletById.get(tx.target_wallet_id ?? '');
      const price = Number(tx.price_toman);
      if (wallet && wallet.currency !== 'IRT' && price > 0) {
        push(wallet.currency, tx.date_string, price, tier);
      }
    }
  }

  return out;
}

export type RateHistories = Record<RateCurrency, RateHistory>;

export function buildRateHistories(src: RateHistorySources): RateHistories {
  const obs = collectRateObservations(src);
  return {
    USD: historyFromObservations(obs.USD),
    TRY: historyFromObservations(obs.TRY),
    EUR: historyFromObservations(obs.EUR),
  };
}

/**
 * USD history from transactions only, cached per array. Used inside the P/L
 * engines as the fallback for rows without their own rate — so every screen
 * that replays the same transactions gets the same estimate.
 */
const txUsdCache = new WeakMap<Transaction[], RateHistory>();
export function usdHistoryFromTransactions(transactions: Transaction[]): RateHistory {
  const hit = txUsdCache.get(transactions);
  if (hit) return hit;
  const history = historyFromObservations(collectRateObservations({ transactions }).USD);
  txUsdCache.set(transactions, history);
  return history;
}

/** Rows to store in `currency_rate_history` (derived estimates, one per observed day). */
export function derivedHistoryRows(histories: RateHistories): RateHistoryRow[] {
  const rows: RateHistoryRow[] = [];
  for (const currency of Object.keys(histories) as RateCurrency[]) {
    for (const p of histories[currency].points) {
      rows.push({ currency, date_string: p.date, toman_per_unit: p.rate });
    }
  }
  return rows;
}
