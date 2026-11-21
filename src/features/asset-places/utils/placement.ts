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

export function placementOf(holding: number, rows: Pick<AssetPlaceHolding, 'place_id' | 'quantity'>[]): Placement {
  const clean = rows.filter((r) => Number(r.quantity) > PLACE_EPSILON).map((r) => ({ placeId: r.place_id, quantity: Number(r.quantity) }));
  const placed = clean.reduce((s, r) => s + r.quantity, 0);
  const h = Math.max(0, holding);
  const diff = h - placed;
  return {
    holding: h,
    placed,
    unplaced: diff > PLACE_EPSILON ? diff : 0,
    over: diff < -PLACE_EPSILON ? -diff : 0,
    rows: clean,
  };
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
