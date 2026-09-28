import { describe, expect, it } from 'vitest';
import {
  assetQuantityFromTransactions,
  calculateAssetStats,
} from '@/shared/utils/calculate-asset-stats';
import { buy, makeTx, sell, testAsset } from '@/test/fixtures';

describe('calculateAssetStats', () => {
  it('realizes P/L only on units actually held (oversell)', () => {
    const txs = [buy('1403/01/01', 1, 100), sell('1403/01/02', 3, 200)];
    const s = calculateAssetStats(testAsset, txs, 'TOMAN', 100);
    // 1 held unit × (200 − 100) = 100, not 3 × 100.
    expect(s.realizedProfitToman).toBe(100);
    expect(s.totalAmount).toBe(0);
  });

  it('keeps average-cost math for normal sells', () => {
    const txs = [buy('1403/01/01', 2, 100), buy('1403/01/02', 2, 200), sell('1403/01/03', 1, 300)];
    const s = calculateAssetStats(testAsset, txs, 'TOMAN', 100);
    expect(s.realizedProfitToman).toBe(150);
    expect(s.totalAmount).toBe(3);
    expect(s.totalCostToman).toBe(450);
  });

  it('falls back to the polymorphic amount when legacy amount is missing', () => {
    const row = makeTx({
      type: 'BUY',
      target_asset_id: 'a1',
      target_amount: 5,
      price_toman: 10,
    });
    expect(assetQuantityFromTransactions('a1', [row])).toBe(5);
  });

  it('ignores asset→asset transfers without a price (unchanged behavior)', () => {
    const row = makeTx({
      type: 'TRANSFER',
      source_asset_id: 'a2',
      target_asset_id: 'a1',
      source_amount: 1,
      target_amount: 1,
    });
    expect(assetQuantityFromTransactions('a1', [buy('1403/01/01', 2, 10), row])).toBe(2);
  });
});
