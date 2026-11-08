import { describe, expect, it } from 'vitest';
import { makeTx } from '@/test/fixtures';
import { avgMonthlyExpense, idleCash, monthProgress, runwayMonths, savingsRate, spendVsLastMonth } from './insights';

const exp = (date: string, toman: number) => makeTx({ type: 'EXPENSE', date_string: date, amount_toman_at_time: toman });
const today = { jy: 1405, jm: 8, jd: 17 };

describe('insights', () => {
  it('average monthly expense of the last 3 full months', () => {
    const txs = [exp('1405/07/05', 30), exp('1405/06/10', 60), exp('1405/05/01', 90), exp('1405/04/30', 999), exp('1405/08/01', 999)];
    expect(avgMonthlyExpense(txs, today)).toBe(60);
  });
  it('runway, savings rate and idle cash', () => {
    expect(runwayMonths(300, 100)).toBe(3);
    expect(runwayMonths(300, 0)).toBeNull();
    expect(savingsRate(100, 25)).toBe(75);
    expect(savingsRate(0, 25)).toBeNull();
    expect(idleCash(1000, 100)).toBe(700);
    expect(idleCash(100, 100)).toBe(0);
  });
  it('spend vs last month up to the same day', () => {
    const txs = [exp('1405/08/03', 50), exp('1405/07/10', 100), exp('1405/07/20', 999)];
    expect(spendVsLastMonth(txs, today)).toEqual({ now: 50, before: 100, change: -50 });
  });
  it('month progress', () => {
    expect(monthProgress({ jy: 1405, jm: 8, jd: 15 })).toBeCloseTo(0.5);
  });
});

import { priceMoves } from './insights';
import type { Asset, DailyPrice } from '@/shared/types/domain';

describe('priceMoves', () => {
  const asset = { id: 'a1', user_id: 'u1', name: 'طلا', unit: 'گرم', price_toman: 110, price_usd: 1.1, include_in_profit_loss: true } as Asset;
  const buy = makeTx({ type: 'BUY', date_string: '1404/01/01', target_asset_id: 'a1', target_amount: 2, asset_id: 'a1', amount: 2, price_toman: 50 });
  const dp = (date: string, price: number): DailyPrice => ({ user_id: 'u1', asset_id: 'a1', date_string: date, price_toman: price, price_usd: price / 100, source: 'auto' });

  it('uses a fresh yesterday price', () => {
    const m = priceMoves([asset], [buy], [dp('1405/08/16', 100)], 100, today);
    expect(m[0]).toMatchObject({ changePct: 10, valueChangeToman: 20 });
  });
  it('ignores a stale last price (old trade)', () => {
    expect(priceMoves([asset], [buy], [], 100, today)).toEqual([]);
  });
});
