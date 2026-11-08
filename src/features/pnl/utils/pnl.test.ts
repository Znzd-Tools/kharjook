import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { computeAssetPnl } from '@/features/reports/utils/asset-pnl';
import { PINNED_NOW, TODAY, USD_RATE, assets, currencyRates, dailyPrices, transactions, wallets } from '@/test/golden/ledger.fixture';
import { buildPnlSummary, percentOf } from './pnl-summary';
import { positionHistory } from './position-history';
import { netWorthChangeThisMonth } from './net-worth-change';

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED_NOW);
});
afterAll(() => vi.useRealTimers());

describe('buildPnlSummary', () => {
  const s = buildPnlSummary(assets, transactions, dailyPrices, USD_RATE, TODAY);

  it('active and all-time equal the v1 dashboard sums', () => {
    let open = 0;
    let all = 0;
    for (const a of assets) {
      const p = computeAssetPnl(a, transactions, dailyPrices, USD_RATE, TODAY);
      if (!p.included) continue;
      all += p.allTime.value.toman;
      if (p.holdings > 0 && p.active.cost.toman > 0) open += p.active.value.toman;
    }
    expect(s.active.value.toman).toBeCloseTo(open, 6);
    expect(s.allTime.value.toman).toBeCloseTo(all, 6);
  });

  it('all-time = realized + unrealized', () => {
    expect(s.allTime.realized.toman + s.allTime.unrealized.toman).toBeCloseTo(s.allTime.value.toman, 6);
  });

  it('year split adds up to the year total', () => {
    expect(s.year.realized.toman + s.year.unrealized.toman).toBeCloseTo(s.year.value.toman, 0);
  });

  it('counts excluded holdings and gives a percent', () => {
    expect(s.excludedCount).toBe(1); // car
    expect(percentOf(s.allTime, 'toman')).not.toBeNull();
  });
});

describe('positionHistory', () => {
  it('splits gold at the day its holding reached zero', () => {
    const gold = assets.find((a) => a.id === 'gold')!;
    const h = positionHistory(gold, transactions, USD_RATE);
    expect(h).toHaveLength(2);
    expect(h[1]).toMatchObject({ start: '1404/03/10', end: '1404/11/20' });
    // 4×(6.5M−5.5M) + 6×(7M−5.5M) = 4M + 9M
    expect(h[1]!.realizedToman).toBeCloseTo(13_000_000, 0);
    expect(h[0]).toMatchObject({ start: '1405/02/05', end: null });
    expect(h[0]!.unrealizedToman).toBeGreaterThan(0);
  });
});

describe('netWorthChangeThisMonth', () => {
  it('change = saving + market and other', () => {
    const n = netWorthChangeThisMonth({ assets, transactions, wallets, dailyPrices, currencyRates }, { jy: 1405, jm: 8, jd: 17 });
    expect(n.change).toBeCloseTo(n.saving + n.marketAndOther, 6);
    expect(n.saving).toBe(45_000_000 - (12_000_000 + 850_000 + 3_200_000 + 450_000 + 2_000_000));
  });
});
