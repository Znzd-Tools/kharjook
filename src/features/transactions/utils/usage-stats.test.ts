import { describe, expect, it } from 'vitest';
import { makeTx } from '@/test/fixtures';
import type { Category } from '@/shared/types/domain';
import { defaultEndpointFor, frequentPatterns, rankCategories, rankEndpoints, typeOrder } from './usage-stats';

const exp = (date: string, cat: string, wallet: string, amount: number) =>
  makeTx({ type: 'EXPENSE', date_string: date, category_id: cat, source_wallet_id: wallet, source_amount: amount });
const cat = (id: string, kind: Category['kind']): Category => ({ id, user_id: 'u1', name: id, color: '', kind, parent_id: null });

describe('typeOrder', () => {
  it('puts expense first with no data', () => {
    expect(typeOrder([])[0]).toBe('EXPENSE');
  });
  it('orders by usage and counts a convert pair once', () => {
    const txs = [
      makeTx({ type: 'BUY' }), makeTx({ type: 'BUY' }), makeTx({ type: 'BUY' }),
      makeTx({ type: 'EXPENSE' }),
      makeTx({ type: 'SELL', operation_id: 'op' }), makeTx({ type: 'BUY', operation_id: 'op' }),
    ];
    const order = typeOrder(txs);
    expect(order[0]).toBe('BUY');
    expect(order.indexOf('CONVERT')).toBeLessThan(order.indexOf('INCOME'));
  });
});

describe('rankCategories', () => {
  it('ranks by usage, then keeps original order', () => {
    const cats = [cat('a', 'expense'), cat('b', 'expense'), cat('c', 'expense'), cat('i', 'income')];
    const txs = [exp('1405/01/01', 'c', 'w', 1), exp('1405/01/02', 'c', 'w', 1), exp('1405/01/03', 'b', 'w', 1)];
    expect(rankCategories(txs, cats, 'expense').map((c) => c.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('defaultEndpointFor', () => {
  it('uses the wallet last used with the category', () => {
    const txs = [exp('1405/01/01', 'cafe', 'cash', 1), exp('1405/02/01', 'cafe', 'bank', 1), exp('1405/03/01', 'rent', 'cash', 1)];
    expect(defaultEndpointFor(txs, 'EXPENSE', 'cafe')).toEqual({ kind: 'wallet', id: 'bank' });
  });
  it('falls back to the most used endpoint for the type', () => {
    const txs = [exp('1405/01/01', 'a', 'cash', 1), exp('1405/01/02', 'b', 'cash', 1), exp('1405/01/03', 'c', 'bank', 1)];
    expect(defaultEndpointFor(txs, 'EXPENSE', 'new')).toEqual({ kind: 'wallet', id: 'cash' });
    expect(defaultEndpointFor([], 'EXPENSE', null)).toBeNull();
  });
});

describe('rankEndpoints', () => {
  it('filters by kind', () => {
    const txs = [makeTx({ type: 'BUY', target_asset_id: 'gold' }), makeTx({ type: 'BUY', target_asset_id: 'gold' }), makeTx({ type: 'BUY', target_asset_id: 'usd' })];
    expect(rankEndpoints(txs, 'BUY', 'target', ['asset']).map((e) => e.id)).toEqual(['gold', 'usd']);
  });
});

describe('frequentPatterns', () => {
  it('finds repeated entries since a date', () => {
    const txs = [
      exp('1405/07/01', 'cafe', 'cash', 85000), exp('1405/07/09', 'cafe', 'cash', 85000), exp('1405/08/01', 'cafe', 'cash', 85000),
      exp('1405/07/02', 'rent', 'bank', 12e6),
      exp('1404/01/01', 'gym', 'bank', 1e6), exp('1404/02/01', 'gym', 'bank', 1e6), // too old
    ];
    const out = frequentPatterns(txs, '1405/05/01');
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ categoryId: 'cafe', amount: 85000, count: 3, lastDate: '1405/08/01' });
  });
});
