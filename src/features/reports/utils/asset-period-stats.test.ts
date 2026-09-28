import { describe, expect, it } from 'vitest';
import { calculateAssetPeriodStats } from '@/features/reports/utils/asset-period-stats';
import type { EffectivePrice } from '@/features/reports/utils/price-history';
import type { Period } from '@/shared/utils/period';
import { buy, testAsset } from '@/test/fixtures';

const price = (toman: number): EffectivePrice => ({
  priceToman: toman,
  priceUsd: toman / 100,
  sourceDate: '1403/02/31',
  isLive: false,
});

const ordibehesht: Period = {
  kind: 'month',
  start: { jy: 1403, jm: 2, jd: 1 },
  end: { jy: 1403, jm: 2, jd: 31 },
};

describe('calculateAssetPeriodStats — past period', () => {
  it('uses holdings at period end, not holdings bought later', () => {
    const txs = [buy('1403/01/10', 1, 100), buy('1403/03/10', 10, 150)];
    const s = calculateAssetPeriodStats(testAsset, txs, ordibehesht, 100, price(120), price(100));
    // Opening 1 unit @100, closes @120 → +20. The later 10 units are irrelevant.
    expect(s.periodUnrealizedAvailable).toBe(true);
    expect(s.periodUnrealizedToman).toBe(20);
    expect(s.endHoldings).toBe(1);
    expect(s.currentHoldings).toBe(11);
  });

  it('matches the old result when nothing happens after the period', () => {
    const txs = [buy('1403/01/10', 1, 100), buy('1403/02/10', 1, 110)];
    const s = calculateAssetPeriodStats(testAsset, txs, ordibehesht, 100, price(120), price(100));
    expect(s.periodUnrealizedToman).toBe(2 * 120 - (100 + 110));
  });
});
