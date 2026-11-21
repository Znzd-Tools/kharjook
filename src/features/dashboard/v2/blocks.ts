/**
 * Dashboard v2 blocks (UX plan §9.1). Order = default order.
 */
export const BLOCKS = [
  { key: 'hero', label: 'ارزش کل دارایی' },
  { key: 'attention', label: 'نیاز به توجه' },
  { key: 'places', label: 'محل نامشخص دارایی‌ها' },
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

/**
 * Clean any stored layout: drop unknown keys, and put a block the stored
 * layout does not know yet right after its default neighbour (not at the end,
 * where a new block would go unseen).
 */
export function normalizeLayout(raw: unknown): DashboardLayout {
  const r = (raw ?? {}) as { order?: unknown[]; hidden?: unknown[] };
  const order = Array.isArray(r.order) ? r.order.filter(isKey) : [];
  const seen = new Set(order);
  BLOCKS.forEach((b, i) => {
    if (seen.has(b.key)) return;
    const prev = i > 0 ? BLOCKS[i - 1]!.key : null;
    const at = prev ? order.indexOf(prev) : -1;
    if (prev && at >= 0) order.splice(at + 1, 0, b.key);
    else if (!prev) order.unshift(b.key);
    else order.push(b.key);
    seen.add(b.key);
  });
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
