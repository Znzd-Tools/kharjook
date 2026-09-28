import { describe, expect, it } from 'vitest';
import { effectiveOpeningPriceAt } from '@/features/reports/utils/price-history';
import type { DailyPrice } from '@/shared/types/domain';
import { testAsset } from '@/test/fixtures';

const snap = (date_string: string, price_toman: number): DailyPrice => ({
  user_id: 'u1',
  asset_id: 'a1',
  date_string,
  price_toman,
  price_usd: price_toman / 100,
  source: 'manual',
});

describe('effectiveOpeningPriceAt', () => {
  it('uses the close of the day before the period', () => {
    const prices = [snap('1402/12/29', 90), snap('1403/01/01', 100)];
    const p = effectiveOpeningPriceAt(testAsset, { jy: 1403, jm: 1, jd: 1 }, prices, '1403/05/01');
    expect(p?.priceToman).toBe(90);
  });

  it('falls back to the first day when there is no earlier snapshot', () => {
    const prices = [snap('1403/01/01', 100)];
    const p = effectiveOpeningPriceAt(testAsset, { jy: 1403, jm: 1, jd: 1 }, prices, '1403/05/01');
    expect(p?.priceToman).toBe(100);
  });
});
