import { describe, expect, it } from 'vitest';
import type { Asset, Category } from '@/shared/types/domain';
import { categoryPortfolioDefault, categoryScope, splitWealth } from './total-wealth';

const asset = (id: string, category_id: string | null, include_in_balance?: boolean) =>
  ({ id, category_id, name: id, include_in_balance }) as Asset;
const cat = (id: string, name: string, in_portfolio?: boolean, ignore_in_wealth?: boolean) =>
  ({ id, name, kind: 'asset', in_portfolio, ignore_in_wealth }) as Category;

describe('splitWealth', () => {
  const categories = [cat('metals', 'فلزات'), cat('physical', 'فیزیکی', false), cat('pledge', 'ضمانت‌ها', false)];

  it('keeps excluded assets out of the portfolio and in total wealth', () => {
    const s = splitWealth(
      [
        { asset: asset('gold', 'metals'), valueToman: 1000 },
        { asset: asset('car', 'physical', false), valueToman: 3000 },
        { asset: asset('rahn', 'pledge', false), valueToman: 1500 },
      ],
      categories,
      200
    );
    expect(s.portfolioToman).toBe(1200);
    expect(s.outsideToman).toBe(4500);
    expect(s.totalWealthToman).toBe(5700);
    expect(s.outsideGroups.map((g) => [g.name, g.valueToman])).toEqual([
      ['فیزیکی', 3000],
      ['ضمانت‌ها', 1500],
    ]);
  });

  it('groups excluded assets without a known category under "بدون دسته"', () => {
    const s = splitWealth([{ asset: asset('x', 'gone', false), valueToman: 10 }, { asset: asset('y', null, false), valueToman: 5 }], categories, 0);
    expect(s.outsideGroups).toEqual([{ id: '__uncat__', name: 'بدون دسته', valueToman: 15 }]);
  });

  it('ignores zero, negative and non-finite values', () => {
    const s = splitWealth(
      [
        { asset: asset('a', 'metals'), valueToman: -5 },
        { asset: asset('b', 'physical', false), valueToman: Number.NaN },
      ],
      categories,
      0
    );
    expect(s.totalWealthToman).toBe(0);
    expect(s.outsideGroups).toEqual([]);
  });
});

describe('ignored categories', () => {
  const categories = [cat('metals', 'فلزات'), cat('pledge', 'ضمانت‌ها', false), cat('equity', 'سرمایه‌گذاری', false, true)];

  it('counts an ignored asset in no total', () => {
    const s = splitWealth(
      [
        { asset: asset('gold', 'metals'), valueToman: 1000 },
        { asset: asset('rahn', 'pledge', false), valueToman: 1500 },
        { asset: asset('stake', 'equity', false), valueToman: 440 },
      ],
      categories,
      0
    );
    expect(s.portfolioToman).toBe(1000);
    expect(s.outsideToman).toBe(1500);
    expect(s.totalWealthToman).toBe(2500);
    expect(s.outsideGroups.map((g) => g.name)).toEqual(['ضمانت‌ها']);
    expect(s.ignoredCount).toBe(1);
    expect(s.ignoredToman).toBe(440);
  });

  it('still counts an asset the user put in the portfolio by hand', () => {
    const s = splitWealth([{ asset: asset('stake', 'equity', true), valueToman: 440 }], categories, 0);
    expect(s.portfolioToman).toBe(440);
    expect(s.ignoredCount).toBe(0);
  });

  it('reads the scope of a category', () => {
    expect(categoryScope(null)).toBe('portfolio');
    expect(categoryScope(cat('a', 'a'))).toBe('portfolio');
    // The ignore flag has no effect while the category is in the portfolio.
    expect(categoryScope(cat('a', 'a', true, true))).toBe('portfolio');
    expect(categoryScope(cat('a', 'a', false))).toBe('wealth_only');
    expect(categoryScope(cat('a', 'a', false, true))).toBe('ignored');
  });
});

describe('categoryPortfolioDefault', () => {
  it('is true unless the category is marked total-wealth-only', () => {
    expect(categoryPortfolioDefault(null)).toBe(true);
    expect(categoryPortfolioDefault(cat('a', 'a'))).toBe(true);
    expect(categoryPortfolioDefault(cat('a', 'a', false))).toBe(false);
  });
});
