import { describe, expect, it } from 'vitest';
import { rollupCategories } from '@/features/reports/utils/category-rollup';
import type { Category } from '@/shared/types/domain';
import { makeTx } from '@/test/fixtures';

const cat = (id: string, parent_id: string | null, kind: Category['kind'] = 'expense'): Category => ({
  id,
  user_id: 'u1',
  name: id,
  color: '#fff',
  kind,
  parent_id,
});

const period = {
  kind: 'month' as const,
  start: { jy: 1403, jm: 1, jd: 1 },
  end: { jy: 1403, jm: 1, jd: 31 },
};

const expense = (category_id: string | null, toman: number) =>
  makeTx({ type: 'EXPENSE', category_id, amount_toman_at_time: toman, source_wallet_id: 'w1' });

describe('rollupCategories', () => {
  it('never drops money whose category is not in the tree', () => {
    const categories = [cat('food', null), cat('salary', null, 'income')];
    const r = rollupCategories({
      transactions: [expense('food', 100), expense('salary', 50), expense('deleted', 25)],
      categories,
      wallets: [],
      period,
      kind: 'expense',
      walletId: null,
      currencyMode: 'TOMAN',
    });
    expect(r.total).toBe(175);
    expect(r.uncategorized.total).toBe(75);
  });

  it('does not loop forever on a parent cycle', () => {
    const categories = [cat('a', 'b'), cat('b', 'a'), cat('root', null)];
    const r = rollupCategories({
      transactions: [expense('a', 10), expense('root', 5)],
      categories,
      wallets: [],
      period,
      kind: 'expense',
      walletId: null,
      currencyMode: 'TOMAN',
    });
    expect(r.total).toBe(15);
  });
});
