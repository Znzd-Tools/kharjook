import { describe, expect, it } from 'vitest';
import type { Category, Transaction } from '@/shared/types/domain';
import { buildBudgetMonth, monthOfDate, planMove, shiftMonth } from './budget';

const cat = (id: string, parent: string | null = null, kind: Category['kind'] = 'expense') =>
  ({ id, user_id: 'u', name: id, color: '#000', kind, parent_id: parent }) as Category;
const tx = (type: string, date: string, amount: number, category_id: string | null) =>
  ({ id: `${date}-${amount}-${category_id}`, type, date_string: date, amount_toman_at_time: amount, category_id }) as unknown as Transaction;

const categories = [cat('food'), cat('cafe', 'food'), cat('rent'), cat('fun'), cat('salary', null, 'income')];
const isoToMonth = () => '1405/06';

describe('budget months', () => {
  it('shifts and reads months', () => {
    expect(shiftMonth('1405/12', 1)).toBe('1406/01');
    expect(shiftMonth('1405/01', -1)).toBe('1404/12');
    expect(monthOfDate('۱۴۰۵/۰۸/۱۷')).toBe('1405/08');
  });
});

describe('buildBudgetMonth', () => {
  const transactions = [
    tx('INCOME', '1405/08/01', 60_000_000, 'salary'),
    tx('EXPENSE', '1405/08/03', 1_000_000, 'cafe'),
    tx('EXPENSE', '1405/08/04', 3_000_000, 'food'),
    tx('EXPENSE', '1405/07/10', 2_000_000, 'food'),
    tx('EXPENSE', '1405/08/05', 15_000_000, 'rent'),
  ];

  it('uses the cap as the monthly amount and counts the subtree', () => {
    const b = buildBudgetMonth({
      month: '1405/08', categories, transactions, isoToMonth,
      caps: [{ category_id: 'food', monthly_limit_toman: 5_000_000 }],
      envelopes: [], allocations: [],
    });
    const food = b.envelopes.find((e) => e.categoryId === 'food')!;
    expect(food).toMatchObject({ assigned: 5_000_000, spent: 4_000_000, available: 1_000_000, carry: 0, custom: false });
    expect(b.income).toBe(60_000_000);
    expect(b.unassigned).toBe(55_000_000);
  });

  it('a sub-category envelope takes its spend out of the parent', () => {
    const b = buildBudgetMonth({
      month: '1405/08', categories, transactions, isoToMonth,
      caps: [{ category_id: 'food', monthly_limit_toman: 5_000_000 }, { category_id: 'cafe', monthly_limit_toman: 2_000_000 }],
      envelopes: [], allocations: [],
    });
    expect(b.envelopes.find((e) => e.categoryId === 'food')!.spent).toBe(3_000_000);
    expect(b.envelopes.find((e) => e.categoryId === 'cafe')!.spent).toBe(1_000_000);
    expect(b.assigned).toBe(7_000_000);
  });

  it('an allocation overrides the cap for one month', () => {
    const b = buildBudgetMonth({
      month: '1405/08', categories, transactions, isoToMonth,
      caps: [{ category_id: 'food', monthly_limit_toman: 5_000_000 }],
      envelopes: [], allocations: [{ category_id: 'food', month: '1405/08', amount_toman: 8_000_000 }],
    });
    expect(b.envelopes[0]).toMatchObject({ assigned: 8_000_000, custom: true, available: 4_000_000 });
  });

  it('rollover carries what is left (or overspent) from earlier months', () => {
    const b = buildBudgetMonth({
      month: '1405/08', categories, transactions, isoToMonth: () => '1405/07',
      caps: [{ category_id: 'food', monthly_limit_toman: 5_000_000 }],
      envelopes: [{ category_id: 'food', rollover: true, created_at: 'x' }], allocations: [],
    });
    // Month 07: 5M given, 2M spent → 3M carries into 08.
    expect(b.envelopes[0]).toMatchObject({ carry: 3_000_000, available: 3_000_000 + 5_000_000 - 4_000_000 });
  });

  it('no rollover → no carry', () => {
    const b = buildBudgetMonth({
      month: '1405/08', categories, transactions, isoToMonth: () => '1405/07',
      caps: [{ category_id: 'food', monthly_limit_toman: 5_000_000 }],
      envelopes: [{ category_id: 'food', rollover: false, created_at: 'x' }], allocations: [],
    });
    expect(b.envelopes[0]!.carry).toBe(0);
  });

  it('ignores income and asset categories as envelopes', () => {
    const b = buildBudgetMonth({
      month: '1405/08', categories, transactions, isoToMonth,
      caps: [], envelopes: [{ category_id: 'salary', rollover: true, created_at: 'x' }], allocations: [],
    });
    expect(b.envelopes).toHaveLength(0);
  });
});

describe('planMove', () => {
  it('writes both allocations', () => {
    const r = planMove('1405/08', { categoryId: 'fun', assigned: 3_000_000, available: 2_000_000 }, { categoryId: 'food', assigned: 5_000_000 }, 1_000_000);
    expect(r).toEqual({
      ok: true,
      rows: [
        { category_id: 'fun', month: '1405/08', amount_toman: 2_000_000 },
        { category_id: 'food', month: '1405/08', amount_toman: 6_000_000 },
      ],
    });
  });
  it('refuses more than is available', () => {
    expect(planMove('1405/08', { categoryId: 'fun', assigned: 3_000_000, available: 500_000 }, { categoryId: 'food', assigned: 0 }, 1_000_000).ok).toBe(false);
  });
});
