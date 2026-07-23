import { describe, expect, it } from 'vitest';
import {
  validateForm,
  validateSourceFunds,
} from '@/features/transactions/utils/transaction-form-logic';
import type { FormState } from '@/features/transactions/utils/transaction-form-types';
import type { Transaction, Wallet } from '@/shared/types/domain';

const baseForm: FormState = {
  type: 'EXPENSE',
  date: '1403/01/01',
  note: '',
  categoryId: 'c1',
  sourceKind: 'wallet',
  sourceId: 'w1',
  targetKind: null,
  targetId: null,
  sourceAmount: '1000',
  targetAmount: '',
  priceToman: '',
  usdRate: '60000',
};

describe('validateForm', () => {
  it('requires date', () => {
    expect(validateForm({ ...baseForm, date: '' }, [])).toBe('تاریخ الزامی است.');
  });

  it('rejects invalid jalali date', () => {
    expect(validateForm({ ...baseForm, date: 'bad' }, [])).toBe('تاریخ نامعتبر است.');
  });
});

describe('validateSourceFunds', () => {
  const wallet = {
    id: 'w1',
    user_id: 'u1',
    name: 'نقد',
    currency: 'IRT',
    initial_balance: 500,
    icon_url: null,
    archived_at: null,
    created_at: '2024-01-01',
  } as Wallet;

  it('blocks amount over wallet balance', () => {
    expect(
      validateSourceFunds(
        { ...baseForm, sourceAmount: '600' },
        [wallet],
        [] as Transaction[],
        []
      )
    ).toBe('موجودی مبدأ کافی نیست.');
  });

  it('allows amount within balance', () => {
    expect(
      validateSourceFunds(
        { ...baseForm, sourceAmount: '100' },
        [wallet],
        [] as Transaction[],
        []
      )
    ).toBe(null);
  });

  it('skips income', () => {
    expect(
      validateSourceFunds(
        { ...baseForm, type: 'INCOME', sourceKind: null, sourceId: null, targetKind: 'wallet', targetId: 'w1' },
        [wallet],
        [],
        []
      )
    ).toBe(null);
  });
});
