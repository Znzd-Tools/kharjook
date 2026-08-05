import { describe, expect, it } from 'vitest';
import {
  recomputeTransferTarget,
  validateForm,
  validateSourceFunds,
} from '@/features/transactions/utils/transaction-form-logic';
import type { FormState } from '@/features/transactions/utils/transaction-form-types';
import type { Asset, Transaction, Wallet } from '@/shared/types/domain';

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

describe('recomputeTransferTarget wallet→asset', () => {
  const irtWallet = {
    id: 'w1',
    user_id: 'u1',
    name: 'نقد',
    currency: 'IRT',
    initial_balance: 10_000_000,
    icon_url: null,
    archived_at: null,
    created_at: '2024-01-01',
  } as Wallet;

  const asset = {
    id: 'a1',
    user_id: 'u1',
    category_id: null,
    name: 'طلا',
    unit: 'گرم',
    decimal_places: 2,
    price_toman: 0,
    price_usd: 0,
    icon_url: null,
    price_source_id: null,
    include_in_profit_loss: true,
  } as Asset;

  const transferForm: FormState = {
    type: 'TRANSFER',
    date: '1403/01/01',
    note: '',
    categoryId: null,
    sourceKind: 'wallet',
    sourceId: 'w1',
    targetKind: 'asset',
    targetId: 'a1',
    sourceAmount: '4000000',
    targetAmount: '',
    priceToman: '',
    usdRate: '60000',
  };

  it('derives qty from form buy price when asset market price is missing', () => {
    const next = recomputeTransferTarget(
      { ...transferForm, priceToman: '2000000' },
      [irtWallet],
      [asset],
      [],
      60000
    );
    expect(next.targetAmount).toBe('2');
  });

  it('falls back to asset market price', () => {
    const priced = { ...asset, price_toman: 2_000_000 };
    const next = recomputeTransferTarget(
      transferForm,
      [irtWallet],
      [priced],
      [],
      60000
    );
    expect(next.targetAmount).toBe('2');
  });

  it('leaves target empty when neither form nor asset has a price', () => {
    const next = recomputeTransferTarget(
      transferForm,
      [irtWallet],
      [asset],
      [],
      60000
    );
    expect(next.targetAmount).toBe('');
  });
});
