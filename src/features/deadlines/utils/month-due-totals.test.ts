import { describe, expect, it } from 'vitest';
import { monthDueTotals } from './timeline';

const today = { jy: 1405, jm: 8, jd: 30 };
const item = (due: string, amount: number, assetId: string | null = null) => ({ due, amount, currency: 'IRT' as const, assetId });

describe('monthDueTotals (Jalali month)', () => {
  it('counts only dues inside the current Jalali month; the next 7 days of next month are not "this month"', () => {
    const r = monthDueTotals([item('1405/08/30', 100), item('1405/09/03', 50), item('1405/08/05', 20)], today, (a) => a);
    expect(r.thisMonth).toBe(120);
  });
  it('keeps overdue money from earlier months apart and skips asset quantities', () => {
    const r = monthDueTotals([item('1405/07/29', 70), item('1405/08/10', 5, 'usdt')], today, (a) => a);
    expect(r).toEqual({ thisMonth: 0, overduePrior: 70 });
  });
});
