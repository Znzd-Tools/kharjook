import { describe, expect, it } from 'vitest';
import {
  formatSubscriptionNativeAmount,
  subscriptionAmountToToman,
} from '@/features/deadlines/utils/subscription-amount-display';

describe('subscription-amount-display', () => {
  it('formats native USD amount', () => {
    expect(formatSubscriptionNativeAmount(9.99, 'USD')).toBe('$ 9.99');
  });

  it('converts foreign amount to toman', () => {
    const toman = subscriptionAmountToToman(10, 'USD', [
      { id: '1', user_id: 'u', currency: 'USD', toman_per_unit: 60000, updated_at: null },
    ]);
    expect(toman).toBe(600000);
  });
});
