/**
 * Rules for a set of allocation goals (unchanged from the old screen):
 *  - group goals together ≤ 100%
 *  - asset goals together ≤ 100%
 *  - asset goals inside one group ≤ that group's goal
 *  - one goal per asset/group and kind
 */
import type { Asset, Category, Goal } from '@/shared/types/domain';

export function validateGoalSet(goals: Goal[], assets: Pick<Asset, 'id' | 'category_id'>[], categories: Pick<Category, 'id' | 'name'>[]): string[] {
  const assetCat = new Map(assets.map((a) => [a.id, a.category_id]));
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  const pct = (g: Goal) => Number(g.target_percent ?? 0);
  const groups = goals.filter((g) => g.scope === 'asset_group' && g.target_kind === 'allocation_percent');
  const items = goals.filter((g) => g.scope === 'asset' && g.target_kind === 'allocation_percent');
  const issues: string[] = [];
  const f = (n: number) => `${n.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪`;

  const groupSum = groups.reduce((s, g) => s + pct(g), 0);
  if (groupSum > 100.0001) issues.push(`جمع هدف گروه‌ها ${f(groupSum)} است و نباید از ۱۰۰٪ بیشتر شود.`);
  const itemSum = items.reduce((s, g) => s + pct(g), 0);
  if (itemSum > 100.0001) issues.push(`جمع هدف دارایی‌ها ${f(itemSum)} است و نباید از ۱۰۰٪ بیشتر شود.`);

  const byGroup = new Map<string, number>();
  for (const g of items) {
    const c = g.asset_id ? assetCat.get(g.asset_id) : null;
    if (c) byGroup.set(c, (byGroup.get(c) ?? 0) + pct(g));
  }
  for (const g of groups) {
    const sum = g.category_id ? byGroup.get(g.category_id) ?? 0 : 0;
    if (sum > pct(g) + 0.0001)
      issues.push(`در گروه «${catName.get(g.category_id!) ?? 'گروه'}»، جمع هدف دارایی‌ها ${f(sum)} از هدف گروه (${f(pct(g))}) بیشتر است.`);
  }

  const seen = new Set<string>();
  for (const g of goals) {
    const k = `${g.scope}|${g.asset_id ?? g.category_id}|${g.target_kind}`;
    if (seen.has(k)) {
      issues.push('برای یک مورد دو هدف از یک نوع ثبت شده است.');
      break;
    }
    seen.add(k);
  }
  return issues;
}
