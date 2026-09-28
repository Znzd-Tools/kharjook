import type { Category, CategorySpendingCap, Transaction } from '@/shared/types/domain';
import { isInPeriod, type Period } from '@/shared/utils/period';

export type CapLevel = 'ok' | 'warn' | 'over';

export type CapStatus = {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  limitToman: number;
  spentToman: number;
  percent: number;
  level: CapLevel;
};

export function capLevelForPercent(percent: number): CapLevel {
  if (percent >= 100) return 'over';
  if (percent >= 80) return 'warn';
  return 'ok';
}

export function collectDescendantCategoryIds(
  categories: Category[],
  rootId: string,
  kind: Category['kind'] = 'expense'
): Set<string> {
  const scoped = categories.filter((category) => category.kind === kind);
  const ids = new Set<string>([rootId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const category of scoped) {
      if (category.parent_id && ids.has(category.parent_id) && !ids.has(category.id)) {
        ids.add(category.id);
        changed = true;
      }
    }
  }
  return ids;
}

export function sumCategoryExpenseToman(
  transactions: Transaction[],
  categoryIds: Set<string>,
  period: Period
): number {
  let total = 0;
  for (const tx of transactions) {
    if (tx.type !== 'EXPENSE') continue;
    if (!tx.category_id || !categoryIds.has(tx.category_id)) continue;
    if (!isInPeriod(tx.date_string, period)) continue;
    const value = Number(tx.amount_toman_at_time);
    if (Number.isFinite(value) && value > 0) total += value;
  }
  return total;
}

export function buildCapStatuses(input: {
  caps: Pick<CategorySpendingCap, 'category_id' | 'monthly_limit_toman'>[];
  categories: Category[];
  transactions: Transaction[];
  period: Period;
}): CapStatus[] {
  const categoryById = new Map(input.categories.map((category) => [category.id, category]));

  return input.caps
    .map((cap) => {
      const category = categoryById.get(cap.category_id);
      if (!category || category.kind !== 'expense') return null;
      const limitToman = Number(cap.monthly_limit_toman);
      if (!(limitToman > 0)) return null;

      const subtreeIds = collectDescendantCategoryIds(input.categories, cap.category_id);
      const spentToman = sumCategoryExpenseToman(input.transactions, subtreeIds, input.period);
      const percent = (spentToman / limitToman) * 100;

      return {
        categoryId: cap.category_id,
        categoryName: category.name,
        categoryColor: category.color,
        limitToman,
        spentToman,
        percent,
        level: capLevelForPercent(percent),
      } satisfies CapStatus;
    })
    .filter((row): row is CapStatus => row != null)
    .sort((a, b) => b.percent - a.percent);
}

export function monthKeyFromPeriod(period: Period): string {
  const { jy, jm } = period.start;
  return `${jy}/${String(jm).padStart(2, '0')}`;
}

export function sumCategoryCapsToman(
  caps: Pick<CategorySpendingCap, 'category_id' | 'monthly_limit_toman'>[],
  categories: Category[],
  kind: Category['kind'] = 'expense'
): number {
  const scoped = categories.filter((category) => category.kind === kind);
  const scopedById = new Map(scoped.map((category) => [category.id, category]));
  const cappedIds = new Set(
    caps
      .filter((cap) => scopedById.has(cap.category_id) && Number(cap.monthly_limit_toman) > 0)
      .map((cap) => cap.category_id)
  );

  // A parent cap already covers its whole subtree (see `buildCapStatuses`),
  // so a child cap under a capped ancestor must not be added again.
  const hasCappedAncestor = (categoryId: string): boolean => {
    const seen = new Set<string>([categoryId]);
    let parentId = scopedById.get(categoryId)?.parent_id ?? null;
    while (parentId && scopedById.has(parentId) && !seen.has(parentId)) {
      if (cappedIds.has(parentId)) return true;
      seen.add(parentId);
      parentId = scopedById.get(parentId)?.parent_id ?? null;
    }
    return false;
  };

  let total = 0;
  for (const cap of caps) {
    if (!scopedById.has(cap.category_id)) continue;
    const limitToman = Number(cap.monthly_limit_toman);
    if (!Number.isFinite(limitToman) || limitToman <= 0) continue;
    if (hasCappedAncestor(cap.category_id)) continue;
    total += limitToman;
  }
  return total;
}
