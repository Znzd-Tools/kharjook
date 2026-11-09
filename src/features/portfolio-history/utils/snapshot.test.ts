import { describe, expect, it } from 'vitest';
import { assets, transactions, wallets } from '@/test/golden/ledger.fixture';
import { buildSnapshot, pastMonthEnds } from './snapshot';

describe('pastMonthEnds', () => {
  it('lists the last day of previous months, oldest first', () => {
    expect(pastMonthEnds('1405/02/10', 3)).toEqual(['1404/11/30', '1404/12/29', '1405/01/31']);
  });
});

describe('buildSnapshot', () => {
  it('total = assets + cash, groups add up to assets', () => {
    const s = buildSnapshot({ assets, wallets, transactions, dailyPrices: [], currencyRates: [{ currency: 'USD', toman_per_unit: 100_000 }] as never, usdRate: 100_000, todayStr: '1405/08/17', dateStr: '1405/08/17' });
    expect(s.total_toman).toBe(s.assets_toman + s.cash_toman);
    const groups = Object.values(s.by_group).reduce((a, b) => a + b, 0);
    expect(Math.abs(groups - s.assets_toman)).toBeLessThanOrEqual(Object.keys(s.by_group).length);
    expect(s.usd_rate).toBe(100_000);
  });
  it('a date before any trade has no assets', () => {
    const s = buildSnapshot({ assets, wallets, transactions, dailyPrices: [], currencyRates: [] as never, usdRate: 0, todayStr: '1405/08/17', dateStr: '1300/01/01' });
    expect(s.assets_toman).toBe(0);
    expect(s.by_asset).toEqual({});
  });
});
