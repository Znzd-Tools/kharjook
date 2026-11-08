/**
 * Usage statistics from the user's own ledger. They drive smart defaults
 * (S6), category ranking (S7) and frequent-transaction chips (S9).
 * Pure functions: no I/O, fully tested.
 */
import type { Category, CategoryKind, Transaction, TransactionType } from '@/shared/types/domain';
import { CONVERT_NOTE_PREFIX, CONVERT_UI_MODE, type UiTransactionMode } from './convert-transaction';

export type EndpointKind = 'wallet' | 'asset' | 'person';
export interface EndpointRef {
  kind: EndpointKind;
  id: string;
}

const DEFAULT_TYPE_ORDER: UiTransactionMode[] = ['EXPENSE', 'INCOME', 'TRANSFER', 'BUY', 'SELL', CONVERT_UI_MODE];

const isConvertRow = (t: Transaction) =>
  (t.type === 'BUY' || t.type === 'SELL') && (Boolean(t.operation_id) || (t.note ?? '').startsWith(CONVERT_NOTE_PREFIX));

/** Most-used type first. Ties keep the default order (expense first). */
export function typeOrder(transactions: Transaction[]): UiTransactionMode[] {
  const counts = new Map<UiTransactionMode, number>();
  for (const t of transactions) {
    if (isConvertRow(t)) {
      // A convert is a SELL + BUY pair: count it once (on the SELL side).
      if (t.type === 'SELL') counts.set(CONVERT_UI_MODE, (counts.get(CONVERT_UI_MODE) ?? 0) + 1);
      continue;
    }
    counts.set(t.type, (counts.get(t.type) ?? 0) + 1);
  }
  return [...DEFAULT_TYPE_ORDER].sort(
    (a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0) || DEFAULT_TYPE_ORDER.indexOf(a) - DEFAULT_TYPE_ORDER.indexOf(b)
  );
}

const newestFirst = (a: Transaction, b: Transaction) =>
  b.date_string.localeCompare(a.date_string) || b.created_at.localeCompare(a.created_at);

/**
 * Categories of one kind, most used first; unused ones follow in their own
 * order. Only categories that exist are returned.
 */
export function rankCategories(transactions: Transaction[], categories: Category[], kind: Exclude<CategoryKind, 'asset'>): Category[] {
  const counts = new Map<string, number>();
  const type: TransactionType = kind === 'expense' ? 'EXPENSE' : 'INCOME';
  for (const t of transactions) {
    if (t.type === type && t.category_id) counts.set(t.category_id, (counts.get(t.category_id) ?? 0) + 1);
  }
  const ofKind = categories.filter((c) => c.kind === kind);
  const position = new Map(ofKind.map((c, i) => [c.id, i]));
  return [...ofKind].sort(
    (a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0)
  );
}

function endpointOf(t: Transaction, side: 'source' | 'target'): EndpointRef | null {
  const s = side === 'source';
  const wallet = s ? t.source_wallet_id : t.target_wallet_id;
  const asset = s ? t.source_asset_id : t.target_asset_id;
  const person = s ? t.source_person_id : t.target_person_id;
  if (wallet) return { kind: 'wallet', id: wallet };
  if (asset) return { kind: 'asset', id: asset };
  if (person) return { kind: 'person', id: person };
  return null;
}

/** Endpoints used on one side of one type, most used first. */
export function rankEndpoints(
  transactions: Transaction[],
  type: TransactionType,
  side: 'source' | 'target',
  kinds?: EndpointKind[]
): EndpointRef[] {
  const counts = new Map<string, { ref: EndpointRef; n: number }>();
  for (const t of transactions) {
    if (t.type !== type || isConvertRow(t)) continue;
    const ref = endpointOf(t, side);
    if (!ref || (kinds && !kinds.includes(ref.kind))) continue;
    const key = `${ref.kind}:${ref.id}`;
    const cur = counts.get(key);
    if (cur) cur.n += 1;
    else counts.set(key, { ref, n: 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).map((x) => x.ref);
}

/**
 * Default money endpoint for a new income/expense:
 * 1. the endpoint last used with this category, else
 * 2. the most used endpoint for this type, else null.
 */
export function defaultEndpointFor(
  transactions: Transaction[],
  type: 'EXPENSE' | 'INCOME',
  categoryId: string | null
): EndpointRef | null {
  const side = type === 'EXPENSE' ? 'source' : 'target';
  if (categoryId) {
    const last = transactions
      .filter((t) => t.type === type && t.category_id === categoryId)
      .sort(newestFirst)
      .map((t) => endpointOf(t, side))
      .find(Boolean);
    if (last) return last;
  }
  return rankEndpoints(transactions, type, side)[0] ?? null;
}

export interface FrequentPattern {
  key: string;
  type: 'EXPENSE' | 'INCOME';
  categoryId: string;
  endpoint: EndpointRef;
  amount: number;
  count: number;
  lastDate: string;
}

/**
 * Repeated income/expense entries (same type, category, endpoint and
 * amount) seen at least `minCount` times on or after `sinceDate`.
 */
export function frequentPatterns(
  transactions: Transaction[],
  sinceDate: string,
  { limit = 4, minCount = 2 } = {}
): FrequentPattern[] {
  const map = new Map<string, FrequentPattern>();
  for (const t of transactions) {
    if ((t.type !== 'EXPENSE' && t.type !== 'INCOME') || !t.category_id || t.date_string < sinceDate) continue;
    const side = t.type === 'EXPENSE' ? 'source' : 'target';
    const endpoint = endpointOf(t, side);
    const amount = Number(side === 'source' ? t.source_amount : t.target_amount);
    if (!endpoint || !Number.isFinite(amount) || amount <= 0) continue;
    const key = `${t.type}|${t.category_id}|${endpoint.kind}:${endpoint.id}|${amount}`;
    const cur = map.get(key);
    if (cur) {
      cur.count += 1;
      if (t.date_string > cur.lastDate) cur.lastDate = t.date_string;
    } else {
      map.set(key, { key, type: t.type, categoryId: t.category_id, endpoint, amount, count: 1, lastDate: t.date_string });
    }
  }
  return [...map.values()]
    .filter((p) => p.count >= minCount)
    .sort((a, b) => b.count - a.count || b.lastDate.localeCompare(a.lastDate))
    .slice(0, limit);
}
