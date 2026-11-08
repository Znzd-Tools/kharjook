import { describe, expect, it } from 'vitest';
import type { Category, Wallet } from '@/shared/types/domain';
import { makeTx } from '@/test/fixtures';
import { search } from './search-index';

const data = {
  wallets: [{ id: 'cash', name: 'نقد', currency: 'IRT', archived_at: null }] as Wallet[],
  assets: [],
  persons: [],
  categories: [{ id: 'cafe', name: 'کافه', kind: 'expense' }] as Category[],
  transactions: [makeTx({ type: 'EXPENSE', category_id: 'cafe', note: 'با علی', date_string: '1405/08/01' })],
};

describe('global search', () => {
  it('finds actions by keyword', () => {
    expect(search('دلار', data).some((r) => r.href === '/manage/rates')).toBe(true);
  });
  it('offers a quick entry first when the text has an amount and a known name', () => {
    const r = search('۸۵ هزار کافه نقد', data);
    expect(r[0]).toMatchObject({ group: 'entry' });
    expect(r[0]!.href).toContain('/transactions/new?text=');
  });
  it('finds categories and transactions', () => {
    const r = search('کافه', data);
    expect(r.some((x) => x.group === 'category' && x.href === '/transactions?category=cafe')).toBe(true);
    expect(r.some((x) => x.group === 'transaction')).toBe(true);
  });
  it('returns nothing for an empty query', () => {
    expect(search('  ', data)).toEqual([]);
  });
});
