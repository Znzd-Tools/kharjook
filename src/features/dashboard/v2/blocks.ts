/**
 * Dashboard v2 blocks (UX plan §9.1). Order = default order.
 */
export const BLOCKS = [
  { key: 'hero', label: 'ارزش کل دارایی' },
  { key: 'attention', label: 'نیاز به توجه' },
  { key: 'pnl', label: 'سود و زیان' },
  { key: 'month', label: 'این ماه' },
  { key: 'networth', label: 'تغییر ارزش این ماه' },
  { key: 'upcoming', label: '۷ روز آینده' },
  { key: 'portfolio', label: 'ترکیب سبد و اهداف' },
  { key: 'movers', label: 'بیشترین تغییر قیمت' },
  { key: 'cashflow', label: 'جریان نقدی امسال' },
  { key: 'quickadd', label: 'ثبت سریع' },
] as const;

export type BlockKey = (typeof BLOCKS)[number]['key'];

export interface DashboardLayout {
  order: BlockKey[];
  hidden: BlockKey[];
}

export const DEFAULT_LAYOUT: DashboardLayout = { order: BLOCKS.map((b) => b.key), hidden: [] };

const isKey = (k: unknown): k is BlockKey => BLOCKS.some((b) => b.key === k);

/** Clean any stored layout: drop unknown keys, append new blocks at the end. */
export function normalizeLayout(raw: unknown): DashboardLayout {
  const r = (raw ?? {}) as { order?: unknown[]; hidden?: unknown[] };
  const order = Array.isArray(r.order) ? r.order.filter(isKey) : [];
  const seen = new Set(order);
  for (const b of BLOCKS) if (!seen.has(b.key)) order.push(b.key);
  const hidden = Array.isArray(r.hidden) ? [...new Set(r.hidden.filter(isKey))] : [];
  return { order: [...new Set(order)], hidden };
}

export function moveBlock(layout: DashboardLayout, key: BlockKey, delta: -1 | 1): DashboardLayout {
  const order = [...layout.order];
  const i = order.indexOf(key);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= order.length) return layout;
  [order[i], order[j]] = [order[j]!, order[i]!];
  return { ...layout, order };
}
