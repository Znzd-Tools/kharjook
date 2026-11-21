import { describe, expect, it } from 'vitest';
import { buildDebts, simulatePayoff, summarizeDebts } from './debts';
import { buildForecast, detectIncome, normalMonthlySpending, subscriptionDates } from './forecast';
import { buildRebalance, buildScorecard, portfolioRisks, type HoldingRow } from './portfolio-plan';

const tx = (o: Record<string, unknown>) => ({ id: Math.random().toString(36), source_amount: null, target_amount: null, amount_toman_at_time: null, ...o }) as never;
const W = [{ id: 'w', currency: 'IRT' }] as never[];

describe('debts', () => {
  const loans = [
    { id: 'l1', title: 'رفاه', type: 'expense', currency: 'IRT', asset_id: null, deleted_at: null, loan_start_date_string: '1405/01/01' },
    { id: 'l2', title: 'تتر', type: 'loan', currency: 'IRT', asset_id: 'usdt', deleted_at: null, loan_start_date_string: '1405/01/01' },
  ] as never[];
  const inst = [
    { loan_id: 'l1', amount: 10, paid_amount: 0, is_paid: false, due_date_string: '1405/09/29' },
    { loan_id: 'l1', amount: 10, paid_amount: 0, is_paid: false, due_date_string: '1405/10/29' },
    { loan_id: 'l1', amount: 10, paid_amount: 10, is_paid: true, due_date_string: '1405/08/29', paid_at: '2026-11-19' },
    { loan_id: 'l2', amount: 100, paid_amount: 40, is_paid: false, due_date_string: '1405/09/30' },
  ] as never[];
  const items = buildDebts({
    loans, installments: inst, transactions: [],
    persons: [{ id: 'p', name: 'بابا', currency: 'USD', initial_balance: -200 }] as never[],
    checks: [
      { id: 'c', title: 'چک', status: 'pending', deleted_at: null, is_guarantee: false, amount: 50, currency: 'IRT', due_date_string: '1405/09/10' },
      { id: 'g', title: 'ضمانت', status: 'pending', deleted_at: null, is_guarantee: true, amount: 999, currency: 'IRT', due_date_string: '1405/12/10' },
    ] as never[],
    assets: [{ id: 'usdt', price_toman: 3, unit: 'تتر', name: 'تتر' }],
    currencyRates: [], usdRate: 2,
  });

  it('counts loans (BNPL apart), asset loans at today price, persons I owe, payable cheques; not guarantees', () => {
    const by = Object.fromEntries(items.map((i) => [i.key, i]));
    expect(by['loan:l1']).toMatchObject({ kind: 'bnpl', remainingToman: 20, endDate: '1405/10/29', fx: false });
    expect(by['loan:l2']).toMatchObject({ kind: 'loan', remaining: 60, remainingToman: 180, fx: true });
    expect(by['person:p']).toMatchObject({ remaining: 200, remainingToman: 400, fx: true, endDate: null });
    expect(by['check:c']!.remainingToman).toBe(50);
    expect(by['check:g']).toBeUndefined();
    const s = summarizeDebts(items);
    expect(s.totalToman).toBe(650);
    expect(s.fxToman).toBe(580);
    expect(s.dueInMonth('1405/09')).toBe(10 + 180 + 50);
    expect(s.debtFreeDate).toBe('1405/10/29');
  });

  it('extra money each month clears debts sooner (snowball, last installments first)', () => {
    const base = simulatePayoff(items.filter((i) => i.kind !== 'person'), '1405/09', 0);
    const extra = simulatePayoff(items.filter((i) => i.kind !== 'person'), '1405/09', 10);
    expect(base.months.get('loan:l1')).toBe(2);
    expect(extra.months.get('loan:l1')).toBe(1);
    expect(extra.debtFreeMonths).toBeLessThanOrEqual(base.debtFreeMonths);
  });
});

describe('forecast', () => {
  const today = { jy: 1405, jm: 8, jd: 20 };
  const txs = [
    tx({ type: 'INCOME', target_wallet_id: 'w', category_id: 'sal', date_string: '1405/05/25', amount_toman_at_time: 100 }),
    tx({ type: 'INCOME', target_wallet_id: 'w', category_id: 'sal', date_string: '1405/06/25', amount_toman_at_time: 120 }),
    tx({ type: 'INCOME', target_wallet_id: 'w', category_id: 'sal', date_string: '1405/07/25', amount_toman_at_time: 110 }),
    tx({ type: 'INCOME', target_wallet_id: 'w', category_id: 'gift', date_string: '1405/07/02', amount_toman_at_time: 999 }),
    tx({ id: 'paid-inst', type: 'EXPENSE', source_wallet_id: 'w', date_string: '1405/07/10', amount_toman_at_time: 300 }),
    tx({ type: 'EXPENSE', source_wallet_id: 'w', date_string: '1405/07/11', amount_toman_at_time: 90 }),
  ];

  it('regular income = a category in 2+ of the last 3 months, median amount, usual day; one-off gifts are not income', () => {
    const inc = detectIncome(txs, today, () => 'حقوق', W, [], 1);
    expect(inc).toHaveLength(1);
    expect(inc[0]).toMatchObject({ categoryId: 'sal', monthlyToman: 110, day: 25 });
  });

  it('normal spending leaves out payments of scheduled items (no double count)', () => {
    expect(normalMonthlySpending(txs, today, new Set(['paid-inst']), W, [], 1)).toBe(30);
  });

  it('subscription dates repeat by interval; overdue counts as today', () => {
    expect(subscriptionDates({ next_due_date_string: '1405/08/10', interval_number: 1, interval_period: 'month' }, '1405/08/20', '1405/10/20')).toEqual([
      '1405/08/20', '1405/09/10', '1405/10/10',
    ]);
  });

  it('finds the lowest point and the first day below zero', () => {
    const f = buildForecast({
      today, horizonDays: 15, startCash: 100,
      income: [{ categoryId: 'sal', label: 'حقوق', monthlyToman: 500, day: 25 }],
      monthlySpending: 0,
      scheduled: [{ due: '1405/08/22', label: 'قسط', toman: 150 }],
    });
    expect(f.firstNegative).toBe('1405/08/22');
    expect(f.lowest).toEqual({ date: '1405/08/22', balance: -50 });
    expect(f.days.find((d) => d.date === '1405/08/25')!.balance).toBe(450);
  });
});

describe('portfolio plan', () => {
  const asset = (id: string, price: number, category_id: string | null = null) => ({ id, name: id, unit: 'u', price_toman: price, category_id }) as never;
  const rows: HoldingRow[] = [
    { asset: asset('gold', 10, 'metal'), quantity: 60, valueToman: 600, priceUsdNow: 12, priceUsdAt: { m3: 10, m6: null, m12: 8 } },
    { asset: asset('usd', 1), quantity: 400, valueToman: 400, priceUsdNow: 1, priceUsdAt: { m3: 1, m6: 1, m12: 1 } },
  ];

  it('scorecard: share and real USD change', () => {
    const s = buildScorecard(rows);
    expect(s[0]).toMatchObject({ assetId: 'gold', sharePct: 60 });
    expect(s[0]!.usd.m3).toBeCloseTo(20);
    expect(s[0]!.usd.m6).toBeNull();
    expect(s[1]!.usd.m12).toBe(0);
  });

  const goals = [
    { scope: 'asset', asset_id: 'usd', category_id: null, target_kind: 'allocation_percent', target_percent: 50 },
    { scope: 'asset_group', asset_id: null, category_id: 'metal', target_kind: 'allocation_percent', target_percent: 50 },
  ] as never[];

  it('new cash goes to what is under target, in units of its asset', () => {
    const p = buildRebalance({ rows, goals, categories: [{ id: 'metal', name: 'فلزات' }] as never[], newCashToman: 200, allowSell: false });
    // total 1200 → targets 600/600: usd needs 200, gold group needs 0
    expect(p.actions).toEqual([expect.objectContaining({ label: 'usd', kind: 'buy', toman: 200, units: 200 })]);
    expect(p.leftoverToman).toBe(0);
  });

  it('with selling: sells the overweight part and buys the underweight', () => {
    const p = buildRebalance({ rows, goals, categories: [] as never[], newCashToman: 0, allowSell: true });
    expect(p.actions.find((a) => a.kind === 'sell')).toMatchObject({ key: 'g:metal', toman: 100, via: 'gold' });
    expect(p.actions.find((a) => a.kind === 'buy')).toMatchObject({ key: 'a:usd', toman: 100 });
  });

  it('risk: concentration, low cash, FX debt bigger than FX assets', () => {
    const r = portfolioRisks({
      score: buildScorecard(rows), groupShares: [], cashToman: 50, avgMonthlySpending: 100,
      fxDebtToman: 900, usdLikeAssetsToman: 400, hasGoals: true,
    });
    expect(r.map((x) => x.key)).toEqual(['conc:gold', 'cash-low', 'fx-debt']);
  });
});
