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

describe('same-day order (zero reset)', () => {
  const T = (h: number) => `2024-07-22T0${h}:00:00Z`;

  it('"sell all, then buy again" on one day closes the old position first', () => {
    const txs = [
      buy('1403/01/01', 10, 100, T(1)),
      sell('1403/02/01', 10, 120, T(2)),
      buy('1403/02/01', 10, 130, T(3)),
    ];
    const s = calculateAssetStats({ ...testAsset, price_toman: 150 }, txs, 'TOMAN', 100);
    expect(s.realizedProfitToman).toBe(200); // 10 × (120 − 100), not 50
    expect(s.totalCostToman).toBe(1300); // new position at 130, not 115
    expect(s.unrealizedProfitToman).toBe(200); // 10 × (150 − 130)
    expect(s.activeSinceDate).toBe('1403/02/01');
  });

  it('falls back to buys-first when the sell was entered before its buy', () => {
    // Real order would sell 5 units that do not exist yet.
    const txs = [
      sell('1403/02/01', 5, 120, T(1)),
      buy('1403/02/01', 5, 100, T(2)),
    ];
    const s = calculateAssetStats(testAsset, txs, 'TOMAN', 100);
    expect(s.realizedProfitToman).toBe(100);
    expect(s.totalAmount).toBe(0);
  });

  it('respects created order for a partial sell then a buy', () => {
    const txs = [
      buy('1403/01/01', 10, 100, T(1)),
      sell('1403/02/01', 4, 150, T(2)),
      buy('1403/02/01', 4, 200, T(3)),
    ];
    const s = calculateAssetStats(testAsset, txs, 'TOMAN', 100);
    expect(s.realizedProfitToman).toBe(200); // 4 × (150 − 100)
    expect(s.totalCostToman).toBe(600 + 800);
  });
});

describe('current value without a live price', () => {
  it('uses the newest BUY/SELL price instead of 0', () => {
    const txs = [buy('1403/01/01', 2, 100), sell('1403/02/01', 1, 140)];
    const s = calculateAssetStats({ ...testAsset, price_toman: 0, price_usd: 0 }, txs, 'TOMAN', 100);
    expect(s.currentPriceSource).toBe('trade');
    expect(s.currentPriceDate).toBe('1403/02/01');
    expect(s.currentValueToman).toBe(140);
    expect(s.unrealizedProfitToman).toBe(40);
  });

  it('keeps the live price when there is one', () => {
    const s = calculateAssetStats(testAsset, [buy('1403/01/01', 1, 100)], 'TOMAN', 100);
    expect(s.currentPriceSource).toBe('live');
    expect(s.currentValueToman).toBe(1000);
  });
});
