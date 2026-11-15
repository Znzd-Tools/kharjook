/**
 * Investment portfolio vs total wealth (pure).
 *
 * - Investment portfolio: assets with `include_in_balance !== false`, plus cash.
 *   This is the number every screen already calls "net worth".
 * - Total wealth: the portfolio plus the assets kept out of it (car, deposit,
 *   private equity ...). Debts are not subtracted.
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
  const outside = new Map<string, number>();
  let inside = 0;
  let outsideToman = 0;
  for (const { asset, valueToman } of rows) {
    const v = Number.isFinite(valueToman) ? Math.max(0, valueToman) : 0;
    if (v === 0) continue;
    if (isInPortfolio(asset)) {
      inside += v;
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
    outsideGroups: [...outside.entries()]
      .map(([id, valueToman]) => ({ id, name: id === UNCAT ? 'بدون دسته' : (nameById.get(id) ?? 'بدون دسته'), valueToman }))
      .sort((a, b) => b.valueToman - a.valueToman),
  };
}
