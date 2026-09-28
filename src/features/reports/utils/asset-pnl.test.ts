import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computeAssetPnl, pnlPercent } from '@/features/reports/utils/asset-pnl';
import type { Asset, DailyPrice } from '@/shared/types/domain';
import { buy, sell, testAsset } from '@/test/fixtures';

/**
 * Hand-calculated scenario (all prices in Toman, USD rate 100 on every row):
 *
 *   1402/10/01  BUY  10 @ 100
 *   1402/11/01  SELL 10 @ 120   → position closed, realized +200, cost resets
 *   1402/12/01  BUY   5 @ 130   → new position starts here
 *   1402/12/15  snapshot price 135 (newest price before 1 Farvardin 1403)
 *   1403/02/01  BUY   5 @ 150
 *   1403/03/01  SELL  4 @ 160
 *   today 1403/05/01, live price 170
 *
 * Lifetime: lots 5@130 + 5@150 → avg 140. Sell 4 → realized 4×20 = 80.
 *   6 left, cost 840, value 1020 → ACTIVE = +180 (21.43% of 840).
 *   ALL-TIME = 200 + 80 + 180 = 460 = sells 1840 − buys 2400 + value 1020.
 * Year 1403: opening 5 units @135 = 675; pool 5@135 + 5@150 → avg 142.5.
 *   Sell 4 → realized 4×17.5 = 70. 6 left, pool cost 855, value 1020 → open 165.
 *   YEAR = 235 = value 1020 − opening 675 − buys 750 + sells 640.
 */
const asset: Asset = { ...testAsset, price_toman: 170, price_usd: 1.7 };
const snapshot: DailyPrice = {
  user_id: 'u1',
  asset_id: 'a1',
  date_string: '1402/12/15',
  price_toman: 135,
  price_usd: 1.35,
  source: 'manual',
};
const txs = [
  buy('1402/10/01', 10, 100),
  sell('1402/11/01', 10, 120),
  buy('1402/12/01', 5, 130),
  buy('1403/02/01', 5, 150),
  sell('1403/03/01', 4, 160),
];
const TODAY = '1403/05/01';

describe('computeAssetPnl — golden scenario', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-07-22T09:00:00Z')); // = 1403/05/01
  });
  afterEach(() => vi.useRealTimers());

  it('active P/L resets after the position hit zero', () => {
    const p = computeAssetPnl(asset, txs, [snapshot], 100, TODAY);
    expect(p.holdings).toBe(6);
    expect(p.active.value.toman).toBeCloseTo(180, 9);
    expect(p.active.cost.toman).toBeCloseTo(840, 9);
    expect(p.active.since).toBe('1402/12/01');
    expect(pnlPercent(p.active.value, p.active.cost, 'TOMAN')).toBeCloseTo(21.4285714, 5);
    expect(p.active.value.usd).toBeCloseTo(1.8, 9);
  });

  it('this-year P/L measures opening units from the opening price', () => {
    const p = computeAssetPnl(asset, txs, [snapshot], 100, TODAY);
    expect(p.year.realized.toman).toBeCloseTo(70, 9);
    expect(p.year.open.toman).toBeCloseTo(165, 9);
    expect(p.year.value.toman).toBeCloseTo(235, 9);
    expect(p.year.base.toman).toBeCloseTo(675 + 750, 9);
    expect(p.year.partial).toBe(false);
    expect(p.year.value.usd).toBeCloseTo(2.35, 9);
  });

  it('all-time P/L = realized + active = sells − buys + value', () => {
    const p = computeAssetPnl(asset, txs, [snapshot], 100, TODAY);
    expect(p.allTime.realized.toman).toBeCloseTo(280, 9);
    expect(p.allTime.value.toman).toBeCloseTo(460, 9);
    expect(p.allTime.invested.toman).toBeCloseTo(2400, 9);
  });

  it('uses the last BUY/SELL price when no snapshot exists', () => {
    // Without the snapshot the newest price before 1403 is the BUY @130.
    const p = computeAssetPnl(asset, txs, [], 100, TODAY);
    // Opening 5 @130 = 650; pool avg (650+750)/10 = 140; realized 4×20 = 80;
    // pool 840, open 1020 − 840 = 180; year = 260 = 1020 − 650 − 750 + 640.
    expect(p.year.value.toman).toBeCloseTo(260, 9);
    expect(p.year.partial).toBe(false);
  });

  it('marks holdings with the newest history price when no live price exists', () => {
    const unpriced: Asset = { ...asset, price_toman: 0, price_usd: 0 };
    const p = computeAssetPnl(unpriced, txs, [], 100, TODAY);
    // Newest trade price is the SELL @160 → 6 × 160 − 840 = 120.
    expect(p.active.value.toman).toBeCloseTo(120, 9);
    expect(p.active.available).toBe(true);
  });

  it('keeps tiny-unit positions open (relative zero check)', () => {
    const tiny = [buy('1403/01/10', 0.001, 1_000_000), sell('1403/01/20', 0.0009992, 1_000_000)];
    const p = computeAssetPnl(asset, tiny, [], 100, TODAY);
    expect(p.holdings).toBeCloseTo(0.0000008, 12);
    expect(p.active.cost.toman).toBeCloseTo(0.8, 6);
  });

  it('closes a position when only float noise is left', () => {
    const noisy = [
      buy('1403/01/10', 0.1, 100),
      buy('1403/01/10', 0.2, 100),
      sell('1403/01/20', 0.30000000000000004, 110),
      buy('1403/02/10', 1, 200),
    ];
    const p = computeAssetPnl(asset, noisy, [], 100, TODAY);
    expect(p.holdings).toBe(1);
    expect(p.active.cost.toman).toBeCloseTo(200, 9);
    expect(p.active.since).toBe('1403/02/10');
  });
});

describe('year P/L adds up to the all-time P/L', () => {
  it('1402 + 1403 = from the beginning', async () => {
    const { calculateAssetPeriodStats } = await import(
      '@/features/reports/utils/asset-period-stats'
    );
    const { effectiveOpeningPriceAt, effectivePriceAt } = await import(
      '@/features/reports/utils/price-history'
    );
    const years = [1402, 1403].map((jy) => {
      const period = {
        kind: 'year' as const,
        start: { jy, jm: 1, jd: 1 },
        end: jy === 1403 ? { jy, jm: 5, jd: 1 } : { jy, jm: 12, jd: 29 },
      };
      const endStr = `${jy}/${jy === 1403 ? '05/01' : '12/29'}`;
      const s = calculateAssetPeriodStats(
        asset,
        txs,
        period,
        100,
        effectivePriceAt(asset, endStr, [snapshot], TODAY, txs),
        effectiveOpeningPriceAt(asset, period.start, [snapshot], TODAY, txs)
      );
      return s.realizedToman + s.periodUnrealizedToman;
    });
    // 1402: value 5×135 − buys 1650 + sells 1200 = 225; 1403: 235.
    expect(years[0]).toBeCloseTo(225, 9);
    expect(years[1]).toBeCloseTo(235, 9);
    expect(years[0]! + years[1]!).toBeCloseTo(460, 9);
  });
});
