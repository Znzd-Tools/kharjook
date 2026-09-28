import { describe, expect, it } from 'vitest';
import {
  buildRateHistories,
  jalaliDayNumber,
  usdHistoryFromTransactions,
} from '@/shared/utils/rate-history';
import { calculateAssetStats } from '@/shared/utils/calculate-asset-stats';
import type { DailyPrice, Wallet } from '@/shared/types/domain';
import { makeTx, testAsset } from '@/test/fixtures';

/** Jalali date → an ISO timestamp on that same day (entered on time). */
function onDay(date: string, plusDays = 0): string {
  const day = jalaliDayNumber(date)! + plusDays;
  return new Date(day * 86_400_000 + 8 * 3_600_000).toISOString();
}

const snap = (date_string: string, toman: number, usd: number): DailyPrice => ({
  user_id: 'u1',
  asset_id: 'a1',
  date_string,
  price_toman: toman,
  price_usd: usd,
  source: 'auto',
});

describe('rate history — interpolation', () => {
  it('draws a straight line between two known days', () => {
    const h = buildRateHistories({
      transactions: [],
      dailyPrices: [snap('1403/01/01', 50_000, 1), snap('1403/01/11', 60_000, 1)],
    }).USD;
    expect(h.at('1403/01/01')).toBe(50_000);
    expect(h.at('1403/01/06')).toBeCloseTo(55_000, 6);
    expect(h.at('1403/01/11')).toBe(60_000);
  });

  it('stays flat before the first and after the last known day', () => {
    const h = buildRateHistories({
      transactions: [],
      dailyPrices: [snap('1403/01/01', 50_000, 1), snap('1403/01/11', 60_000, 1)],
    }).USD;
    expect(h.at('1402/06/01')).toBe(50_000);
    expect(h.at('1404/01/01')).toBe(60_000);
    expect(h.latest()).toBe(60_000);
  });

  it('returns null with no data at all', () => {
    expect(buildRateHistories({ transactions: [] }).USD.at('1403/01/01')).toBeNull();
  });
});

describe('rate history — sources', () => {
  it('prefers a saved (manual/provider) rate over other sources on the same day', () => {
    const h = buildRateHistories({
      transactions: [
        makeTx({ type: 'BUY', date_string: '1403/02/01', usd_rate: 61_000, created_at: onDay('1403/02/01') }),
      ],
      dailyPrices: [snap('1403/02/01', 62_000, 1)],
      savedHistory: [{ currency: 'USD', date_string: '1403/02/01', toman_per_unit: 60_000 }],
    }).USD;
    expect(h.at('1403/02/01')).toBe(60_000);
  });

  it('ignores INCOME/EXPENSE rows entered long after their date (auto-filled rate)', () => {
    const h = buildRateHistories({
      transactions: [
        makeTx({
          type: 'EXPENSE',
          date_string: '1403/01/10',
          amount_toman_at_time: 1_000_000,
          amount_usd_at_time: 10, // today's 100k rate, not the real one
          usd_rate: null,
          created_at: onDay('1403/01/10', 90),
        }),
        makeTx({
          type: 'EXPENSE',
          date_string: '1403/01/20',
          amount_toman_at_time: 580_000,
          amount_usd_at_time: 10,
          usd_rate: null,
          created_at: onDay('1403/01/20'),
        }),
      ],
    }).USD;
    expect(h.points.map((p) => p.date)).toEqual(['1403/01/20']);
    expect(h.at('1403/01/10')).toBe(58_000);
  });

  it('drops an obvious typo against its neighbours', () => {
    const days = ['1403/03/01', '1403/03/05', '1403/03/10', '1403/03/15', '1403/03/20'];
    const rates = [60_000, 60_500, 6_100, 61_000, 61_500]; // one missing zero
    const h = buildRateHistories({
      transactions: [],
      dailyPrices: days.map((d, i) => snap(d, rates[i]!, 1)),
    }).USD;
    expect(h.points.find((p) => p.date === '1403/03/10')).toBeUndefined();
    expect(h.at('1403/03/10')).toBeCloseTo(60_750, 6);
  });

  it('builds EUR history from EUR wallet rows', () => {
    const eurWallet = { id: 'we', currency: 'EUR' } as Wallet;
    const h = buildRateHistories({
      transactions: [
        makeTx({
          type: 'EXPENSE',
          date_string: '1403/04/01',
          source_wallet_id: 'we',
          price_toman: 70_000,
          usd_rate: null,
          created_at: onDay('1403/04/01'),
        }),
      ],
      wallets: [eurWallet],
    });
    expect(h.EUR.at('1403/04/15')).toBe(70_000);
  });
});

describe('P/L engine uses the history for rows without a USD rate', () => {
  it('prices a legacy BUY in USD at the rate of its date, not today', () => {
    const txs = [
      makeTx({
        type: 'BUY',
        date_string: '1403/01/01',
        target_asset_id: 'a1',
        asset_id: 'a1',
        amount: 1,
        price_toman: 50_000,
        usd_rate: null,
        created_at: onDay('1403/01/01'),
      }),
      makeTx({
        type: 'SELL',
        date_string: '1403/01/11',
        source_asset_id: 'b9',
        asset_id: 'b9',
        amount: 1,
        price_toman: 1,
        usd_rate: 50_000,
        created_at: onDay('1403/01/11'),
      }),
    ];
    expect(usdHistoryFromTransactions(txs).at('1403/01/01')).toBe(50_000);
    const s = calculateAssetStats(testAsset, txs, 'USD', 100_000 /* today */);
    // Cost = 50k Toman ÷ 50k (rate of its date) = $1, not $0.5.
    expect(s.totalCostUsd).toBeCloseTo(1, 9);
  });
});
