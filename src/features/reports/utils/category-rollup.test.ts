import { describe, expect, it } from 'vitest';
import { dailyCashflow, rollupCategories } from '@/features/reports/utils/category-rollup';
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

describe('dailyCashflow', () => {
  const tx = (date: string, toman: number | null, wallet = 'w1') =>
    makeTx({ type: 'EXPENSE', date_string: date, amount_toman_at_time: toman, source_wallet_id: wallet });
  it('sums per day in the period, same rules as the report', () => {
    const m = dailyCashflow({
      transactions: [tx('1403/01/02', 100), tx('1403/01/02', 50), tx('1403/01/05', 20), tx('1403/02/01', 999), tx('1403/01/06', null)],
      period,
      kind: 'expense',
      walletId: null,
      currencyMode: 'TOMAN',
    });
    expect(Object.fromEntries(m)).toEqual({ '1403/01/02': 150, '1403/01/05': 20 });
  });
  it('wallet filter', () => {
    const m = dailyCashflow({ transactions: [tx('1403/01/02', 100, 'w1'), tx('1403/01/02', 7, 'w2')], period, kind: 'expense', walletId: 'w2', currencyMode: 'TOMAN' });
    expect(m.get('1403/01/02')).toBe(7);
  });
});
