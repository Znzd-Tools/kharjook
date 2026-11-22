/**
 * Asset places: a virtual split of an asset's quantity over the user's own
 * places. Pure helpers, no I/O.
 */
export type AssetPlaceKind = 'exchange' | 'wallet' | 'bank' | 'cash' | 'other';

export interface AssetPlace {
  id: string;
  user_id: string;
  name: string;
  kind: AssetPlaceKind;
  note: string | null;
  order_index: number | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetPlaceHolding {
  id: string;
  user_id: string;
  asset_id: string;
  place_id: string;
  quantity: number;
  updated_at: string;
}

export const PLACE_KIND_LABEL: Record<AssetPlaceKind, string> = {
  exchange: 'صرافی',
  wallet: 'کیف پول',
  bank: 'بانک',
  cash: 'نقد / فیزیکی',
  other: 'سایر',
};

/** Below this, a leftover is rounding noise (e.g. 0.00000001 USDT). */
export const PLACE_EPSILON = 1e-9;

export interface Placement {
  /** Quantity the user holds now (from the ledger). */
  holding: number;
  /** Sum put in places. */
  placed: number;
  /** holding − placed when > 0: "where is this?" */
  unplaced: number;
  /** placed − holding when > 0: places say more than you have (e.g. after a sell). */
  over: number;
  rows: { placeId: string; quantity: number }[];
}

/**
 * Noise limit for an asset: half of its smallest shown unit (USDT with 2
 * decimals: 0.005). A difference below it is invisible, so it is not
 * "unplaced" (float sums like 623.3799999999999 vs 623.38).
 */
export function placeTolerance(decimals: number): number {
  return Math.max(PLACE_EPSILON, 0.5 * 10 ** -Math.max(0, decimals));
}

export function placementOf(
  holding: number,
  rows: Pick<AssetPlaceHolding, 'place_id' | 'quantity'>[],
  tolerance = PLACE_EPSILON
): Placement {
  const clean = rows.filter((r) => Number(r.quantity) > PLACE_EPSILON).map((r) => ({ placeId: r.place_id, quantity: Number(r.quantity) }));
  const placed = clean.reduce((s, r) => s + r.quantity, 0);
  const h = Math.max(0, holding);
  const diff = h - placed;
  return {
    holding: h,
    placed,
    unplaced: diff >= tolerance ? diff : 0,
    over: diff <= -tolerance ? -diff : 0,
    rows: clean,
  };
}

/**
 * The holding went down below what the places say (sell, expense, payment).
 *  - one place, or nothing left: the answer is clear → `auto` with the new map.
 *  - several places: the user must say where it came from → `ask`.
 */
export function reconcileOver(p: Placement): { kind: 'none' } | { kind: 'auto'; next: Map<string, number> } | { kind: 'ask' } {
  if (!(p.over > 0)) return { kind: 'none' };
  if (p.holding <= 0) return { kind: 'auto', next: new Map(p.rows.map((r) => [r.placeId, 0])) };
  if (p.rows.length === 1) return { kind: 'auto', next: new Map([[p.rows[0]!.placeId, p.holding]]) };
  return { kind: 'ask' };
}

/**
 * Take `taken` (per place) out of the places. The total must equal `p.over`
 * within `tolerance`; the rounding rest goes to the place that keeps the
 * most, so the places sum to the holding exactly.
 */
export function applyReduction(p: Placement, taken: Map<string, number>, tolerance: number): { next: Map<string, number> } | { error: string } {
  let sum = 0;
  for (const r of p.rows) {
    const t = taken.get(r.placeId) ?? 0;
    if (t < 0) return { error: 'مقدار منفی مجاز نیست.' };
    if (t > r.quantity + tolerance) return { error: 'از یک محل بیشتر از موجودی‌اش برداشته‌ای.' };
    sum += t;
  }
  if (Math.abs(sum - p.over) >= tolerance) return { error: 'جمع مقدارها باید با مقدار کم‌شده برابر باشد.' };
  const next = new Map(p.rows.map((r) => {
    const left = r.quantity - (taken.get(r.placeId) ?? 0);
    return [r.placeId, left < tolerance ? 0 : left] as const;
  }));
  // Put the rounding rest on the place that keeps the most.
  const keeper = [...next.entries()].sort((a, b) => b[1] - a[1])[0];
  if (keeper && keeper[1] > 0) {
    const rest = p.holding - [...next.values()].reduce((s, v) => s + v, 0);
    next.set(keeper[0], Math.max(0, keeper[1] + rest));
  }
  return { next };
}

/**
 * Move `qty` from one place to another (or from "unplaced" when `from` is null).
 * Returns the new quantity per place id, or an error text.
 */
export function moveBetweenPlaces(
  current: Map<string, number>,
  unplaced: number,
  from: string | null,
  to: string,
  qty: number
): { next: Map<string, number> } | { error: string } {
  if (!(qty > 0)) return { error: 'مقدار باید بیشتر از صفر باشد.' };
  if (from === to) return { error: 'مبدأ و مقصد یکی است.' };
  const available = from === null ? unplaced : (current.get(from) ?? 0);
  if (qty > available + PLACE_EPSILON) return { error: 'بیشتر از مقدار موجود در مبدأ است.' };
  const next = new Map(current);
  if (from !== null) next.set(from, Math.max(0, (next.get(from) ?? 0) - qty));
  next.set(to, (next.get(to) ?? 0) + qty);
  return { next };
}
