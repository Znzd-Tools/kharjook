import { describe, expect, it } from 'vitest';
import { makeTx } from '@/test/fixtures';
import type { Asset, Category, Person, Wallet } from '@/shared/types/domain';
import { describeTransaction, netToman } from './describe-transaction';

const l = {
  wallets: [{ id: 'w1', name: 'ملت', currency: 'IRT' }, { id: 'w2', name: 'دلاری', currency: 'USD' }] as Wallet[],
  assets: [{ id: 'a1', name: 'طلا', unit: 'گرم' }] as Asset[],
  persons: [{ id: 'p1', name: 'علی' }] as Person[],
  categories: [{ id: 'c1', name: 'کافه', kind: 'expense' }] as Category[],
};

describe('describeTransaction', () => {
  it('expense: category title, wallet subtitle, money out', () => {
    const v = describeTransaction(makeTx({ type: 'EXPENSE', source_wallet_id: 'w1', source_amount: 85000, category_id: 'c1', note: 'با علی' }), l);
    expect(v).toMatchObject({ title: 'کافه', subtitle: 'ملت · با علی', amount: 85000, unit: 'TOMAN', direction: -1 });
  });
  it('income in a USD wallet keeps the wallet currency', () => {
    const v = describeTransaction(makeTx({ type: 'INCOME', target_wallet_id: 'w2', target_amount: 50 }), l);
    expect(v).toMatchObject({ title: 'درآمد', amount: 50, unit: 'USD', direction: 1 });
  });
  it('transfer says from and to', () => {
    const v = describeTransaction(makeTx({ type: 'TRANSFER', source_wallet_id: 'w1', target_person_id: 'p1', source_amount: 2e6, target_amount: 2e6 }), l);
    expect(v.subtitle).toBe('از ملت به علی');
    expect(v.direction).toBe(0);
  });
  it('buy shows asset, quantity and money paid', () => {
    const v = describeTransaction(makeTx({ type: 'BUY', source_wallet_id: 'w1', source_amount: 9e6, target_asset_id: 'a1', target_amount: 1, price_toman: 9e6 }), l);
    expect(v).toMatchObject({ title: 'خرید طلا', amount: 9e6, unit: 'TOMAN' });
    expect(v.subtitle).toContain('گرم');
    expect(v.subtitle).toContain('از ملت');
  });
  it('sell without a wallet uses quantity × price', () => {
    const v = describeTransaction(makeTx({ type: 'SELL', source_asset_id: 'a1', source_amount: 2, price_toman: 5 }), l);
    expect(v.amount).toBe(10);
  });
});

describe('netToman', () => {
  it('sums snapshots and counts unpriced rows', () => {
    const rows = [
      makeTx({ type: 'INCOME', amount_toman_at_time: 100 }),
      makeTx({ type: 'EXPENSE', amount_toman_at_time: 30 }),
      makeTx({ type: 'EXPENSE', amount_toman_at_time: null }),
      makeTx({ type: 'TRANSFER', amount_toman_at_time: 999 }),
    ];
    expect(netToman(rows)).toEqual({ income: 100, expense: 30, unpriced: 1 });
  });
});
