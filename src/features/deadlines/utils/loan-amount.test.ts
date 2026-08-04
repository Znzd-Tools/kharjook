import { describe, expect, it } from 'vitest';
import { isAssetLoan, loanAmountToToman } from '@/features/deadlines/utils/loan-amount';

describe('loan-amount', () => {
  it('detects asset vs fiat loan', () => {
    expect(isAssetLoan({ asset_id: 'a1' })).toBe(true);
    expect(isAssetLoan({ asset_id: null })).toBe(false);
  });

  it('prices asset qty by asset.price_toman', () => {
    const toman = loanAmountToToman(
      25,
      { currency: 'IRT', asset_id: 'gold' },
      [],
      new Map([['gold', { price_toman: 40_000_000 }]])
    );
    expect(toman).toBe(1_000_000_000);
  });

  it('prices fiat via currency rates', () => {
    const toman = loanAmountToToman(
      10,
      { currency: 'USD', asset_id: null },
      [{ id: '1', user_id: 'u', currency: 'USD', toman_per_unit: 60_000, updated_at: '' }],
      new Map()
    );
    expect(toman).toBe(600_000);
  });
});
