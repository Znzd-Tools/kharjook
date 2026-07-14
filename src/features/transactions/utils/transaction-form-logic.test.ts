import { describe, expect, it } from 'vitest';
import { validateForm } from '@/features/transactions/utils/transaction-form-logic';
import type { FormState } from '@/features/transactions/utils/transaction-form-types';

const baseForm: FormState = {
  type: 'EXPENSE',
  date: '1403/01/01',
  note: '',
  categoryId: null,
  sourceKind: 'wallet',
  sourceId: 'w1',
  targetKind: null,
  targetId: null,
  amount: '1000',
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
