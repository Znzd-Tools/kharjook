import { describe, expect, it } from 'vitest';
import type { FormState } from './transaction-form-types';
import { applyDraft, draftFromParams } from './entry-draft';

const base: FormState = {
  type: 'EXPENSE', date: '1405/08/17', sourceKind: null, sourceId: null, targetKind: null, targetId: null,
  sourceAmount: '', targetAmount: '', priceToman: '', usdRate: '100000', categoryId: null, note: '',
};
const wallets = [{ id: 'a', currency: 'IRT' as const }, { id: 'b', currency: 'IRT' as const }, { id: 'u', currency: 'USD' as const }];

describe('entry draft', () => {
  it('reads and validates params', () => {
    expect(draftFromParams({})).toBeNull();
    expect(draftFromParams({ sms: '1', type: 'HACK', amt: '1e9', date: 'x' })).toMatchObject({ type: 'EXPENSE', amt: undefined, date: undefined });
    expect(draftFromParams({ sms: '1', type: 'TRANSFER', to: 'person' })?.person).toBe('target');
  });

  it('expense: wallet + amount + date + note', () => {
    expect(applyDraft(base, { type: 'EXPENSE', src: 'wallet:a', amt: '100000', date: '1405/08/05', note: 'کافه' }, wallets)).toMatchObject({
      sourceKind: 'wallet', sourceId: 'a', sourceAmount: '100000', date: '1405/08/05', note: 'کافه',
    });
  });

  it('income and sell fill the target side', () => {
    expect(applyDraft(base, { type: 'INCOME', dst: 'wallet:a', amt: '5' }, wallets)).toMatchObject({ targetId: 'a', targetAmount: '5', sourceAmount: '' });
    expect(applyDraft(base, { type: 'SELL', dst: 'wallet:a', amt: '5' }, wallets)).toMatchObject({ targetAmount: '5' });
  });

  it('transfer between Toman wallets: both sides', () => {
    expect(applyDraft(base, { type: 'TRANSFER', src: 'wallet:a', dst: 'wallet:b', amt: '7' }, wallets)).toMatchObject({ sourceAmount: '7', targetAmount: '7' });
  });

  it('currency convert: only the Toman side', () => {
    expect(applyDraft(base, { type: 'TRANSFER', src: 'wallet:u', dst: 'wallet:a', amt: '7', side: 'dst' }, wallets)).toMatchObject({ sourceAmount: '', targetAmount: '7' });
  });
});
