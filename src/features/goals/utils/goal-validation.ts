/**
 * Rules for a set of allocation goals:
 *  - group and set ("basket") goals together ≤ 100%
 *  - asset goals together ≤ 100%
 *  - asset goals inside one group or set ≤ that group's / set's goal
 *  - an asset is in at most one set, and not in a set and a group with goals
 *    at the same time (it would count twice)
 *  - one goal per asset/group and kind
 */
import type { Asset, Category, Goal } from '@/shared/types/domain';

/** Asset ids of a basket goal (empty for other goals). */
export const basketAssetIds = (g: Pick<Goal, 'scope' | 'asset_ids'>): string[] => (g.scope === 'basket' ? (g.asset_ids ?? []) : []);

export function validateGoalSet(
  goals: Goal[],
  assets: Pick<Asset, 'id' | 'category_id' | 'name'>[],
  categories: Pick<Category, 'id' | 'name'>[]
): string[] {
  const assetCat = new Map(assets.map((a) => [a.id, a.category_id]));
  const assetName = new Map(assets.map((a) => [a.id, a.name]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const pct = (g: Goal) => Number(g.target_percent ?? 0);
  const groups = goals.filter((g) => g.scope === 'asset_group' && g.target_kind === 'allocation_percent');
  const baskets = goals.filter((g) => g.scope === 'basket');
  const items = goals.filter((g) => g.scope === 'asset' && g.target_kind === 'allocation_percent');
  const issues: string[] = [];
  const f = (n: number) => `${n.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪`;

  for (const b of baskets) {
    if (basketAssetIds(b).length < 2) issues.push(`مجموعه‌ی «${b.name ?? ''}» باید حداقل دو دارایی داشته باشد.`);
  }

  const topSum = [...groups, ...baskets].reduce((s, g) => s + pct(g), 0);
  if (topSum > 100.0001)
    issues.push(`جمع هدف گروه‌ها${baskets.length ? ' و مجموعه‌ها' : ''} ${f(topSum)} است و نباید از ۱۰۰٪ بیشتر شود.`);
  const itemSum = items.reduce((s, g) => s + pct(g), 0);
  if (itemSum > 100.0001) issues.push(`جمع هدف دارایی‌ها ${f(itemSum)} است و نباید از ۱۰۰٪ بیشتر شود.`);

  // An asset belongs to one set at most, and not to a set and a goal group together.
  const basketOf = new Map<string, Goal>();
  const groupCats = new Set(groups.map((g) => g.category_id));
  for (const b of baskets) {
    for (const id of basketAssetIds(b)) {
      const other = basketOf.get(id);
      if (other) issues.push(`«${assetName.get(id) ?? 'دارایی'}» در دو مجموعه هست («${other.name ?? ''}» و «${b.name ?? ''}»).`);
      basketOf.set(id, b);
      const cat = assetCat.get(id);
      if (cat && groupCats.has(cat))
        issues.push(`«${assetName.get(id) ?? 'دارایی'}» هم در مجموعه‌ی «${b.name ?? ''}» است و هم در گروه «${catName.get(cat) ?? ''}» که هدف دارد؛ دو بار حساب می‌شود.`);
    }
  }

  const byGroup = new Map<string, number>();
  const byBasket = new Map<string, number>();
  for (const g of items) {
    if (!g.asset_id) continue;
    const b = basketOf.get(g.asset_id);
    if (b) byBasket.set(b.id, (byBasket.get(b.id) ?? 0) + pct(g));
    const c = assetCat.get(g.asset_id);
    if (c) byGroup.set(c, (byGroup.get(c) ?? 0) + pct(g));
  }
  for (const g of groups) {
    const sum = g.category_id ? byGroup.get(g.category_id) ?? 0 : 0;
    if (sum > pct(g) + 0.0001)
      issues.push(`در گروه «${catName.get(g.category_id!) ?? 'گروه'}»، جمع هدف دارایی‌ها ${f(sum)} از هدف گروه (${f(pct(g))}) بیشتر است.`);
  }
  for (const b of baskets) {
    const sum = byBasket.get(b.id) ?? 0;
    if (sum > pct(b) + 0.0001) issues.push(`در مجموعه‌ی «${b.name ?? ''}»، جمع هدف دارایی‌ها ${f(sum)} از هدف مجموعه (${f(pct(b))}) بیشتر است.`);
  }

  const seen = new Set<string>();
  for (const g of goals) {
    if (g.scope === 'basket') continue;
    const k = `${g.scope}|${g.asset_id ?? g.category_id}|${g.target_kind}`;
    if (seen.has(k)) {
      issues.push('برای یک مورد دو هدف از یک نوع ثبت شده است.');
      break;
    }
    seen.add(k);
  }
  return issues;
}
