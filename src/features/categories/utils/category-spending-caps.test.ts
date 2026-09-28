import { describe, expect, it } from 'vitest';
import { sumCategoryCapsToman } from '@/features/categories/utils/category-spending-caps';
import type { Category } from '@/shared/types/domain';

const cat = (id: string, parent_id: string | null): Category => ({
  id,
  user_id: 'u1',
  name: id,
  color: '#fff',
  kind: 'expense',
  parent_id,
});

describe('sumCategoryCapsToman', () => {
  const categories = [cat('food', null), cat('cafe', 'food'), cat('rent', null)];

  it('does not add a child cap under a capped parent', () => {
    const caps = [
      { category_id: 'food', monthly_limit_toman: 1000 },
      { category_id: 'cafe', monthly_limit_toman: 300 },
      { category_id: 'rent', monthly_limit_toman: 5000 },
    ];
    expect(sumCategoryCapsToman(caps, categories)).toBe(6000);
  });

  it('adds child caps when the parent has no cap', () => {
    const caps = [{ category_id: 'cafe', monthly_limit_toman: 300 }];
    expect(sumCategoryCapsToman(caps, categories)).toBe(300);
  });

  it('survives a parent cycle', () => {
    const cyclic = [cat('x', 'y'), cat('y', 'x')];
    const caps = [{ category_id: 'x', monthly_limit_toman: 10 }];
    expect(sumCategoryCapsToman(caps, cyclic)).toBe(10);
  });
});
