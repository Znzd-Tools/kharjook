/**
 * Investment portfolio vs total wealth (pure).
 *
 * - Investment portfolio: assets with `include_in_balance !== false`, plus cash.
 *   This is the number every screen already calls "net worth".
 * - Total wealth: the portfolio plus the assets kept out of it (car, deposit
 *   ...). Debts are not subtracted.
 * - Ignored: an out-of-portfolio asset in an "ignored" category counts in
 *   no total. An asset the user put in the portfolio by hand always counts.
 */
import type { Asset, Category } from '@/shared/types/domain';

export interface AssetValueRow {
  asset: Asset;
  valueToman: number;
}

export interface OutsideGroup {
  /** Category id, or `__uncat__`. */
  id: string;
  name: string;
  valueToman: number;
}

export interface WealthSplit {
  /** Assets in the portfolio + cash. */
  portfolioToman: number;
  /** Assets kept out of the portfolio. */
  outsideToman: number;
  /** portfolioToman + outsideToman. */
  totalWealthToman: number;
  /** Out-of-portfolio value by category, biggest first. */
  outsideGroups: OutsideGroup[];
  /** Assets with a value that count in no total (ignored categories). */
  ignoredCount: number;
  /** Value of the ignored assets. In no total; for a note only. */
  ignoredToman: number;
}

/** Where the assets of an asset category count. */
export type CategoryScope = 'portfolio' | 'wealth_only' | 'ignored';

export function categoryScope(
  category: Pick<Category, 'in_portfolio' | 'ignore_in_wealth'> | null | undefined
): CategoryScope {
  if (category?.in_portfolio !== false) return 'portfolio';
  return category.ignore_in_wealth === true ? 'ignored' : 'wealth_only';
}

const UNCAT = '__uncat__';

export function isInPortfolio(asset: Pick<Asset, 'include_in_balance'>): boolean {
  return asset.include_in_balance !== false;
}

/** Default of `include_in_balance` for an asset put in this category. */
export function categoryPortfolioDefault(category: Pick<Category, 'in_portfolio'> | null | undefined): boolean {
  return category?.in_portfolio !== false;
}

export function splitWealth(rows: AssetValueRow[], categories: Category[], cashToman: number): WealthSplit {
  const nameById = new Map(categories.map((c) => [c.id, c.name]));
  const ignoredIds = new Set(categories.filter((c) => categoryScope(c) === 'ignored').map((c) => c.id));
  const outside = new Map<string, number>();
  let inside = 0;
  let outsideToman = 0;
  let ignoredCount = 0;
  let ignoredToman = 0;
  for (const { asset, valueToman } of rows) {
    const v = Number.isFinite(valueToman) ? Math.max(0, valueToman) : 0;
    if (v === 0) continue;
    if (isInPortfolio(asset)) {
      inside += v;
      continue;
    }
    if (asset.category_id && ignoredIds.has(asset.category_id)) {
      ignoredCount += 1;
      ignoredToman += v;
      continue;
    }
    outsideToman += v;
    const id = asset.category_id && nameById.has(asset.category_id) ? asset.category_id : UNCAT;
    outside.set(id, (outside.get(id) ?? 0) + v);
  }
  const portfolioToman = inside + (Number.isFinite(cashToman) ? cashToman : 0);
  return {
    portfolioToman,
    outsideToman,
    totalWealthToman: portfolioToman + outsideToman,
    ignoredCount,
    ignoredToman,
    outsideGroups: [...outside.entries()]
      .map(([id, valueToman]) => ({ id, name: id === UNCAT ? 'بدون دسته' : (nameById.get(id) ?? 'بدون دسته'), valueToman }))
      .sort((a, b) => b.valueToman - a.valueToman),
  };
}
