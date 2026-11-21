/**
 * Debt overview and payoff simulation. Pure, no I/O.
 *
 * A debt is anything you still have to pay: a loan, an installment purchase
 * (BNPL), a person you owe, or a payable cheque. Amounts are converted to
 * Toman at today's rates; debts in a foreign currency or an asset (USD, USDT,
 * gold …) are marked `fx`: their Toman size moves with the market.
 */
import type { Asset, Check, Currency, CurrencyRate, Loan, LoanInstallment, Person } from '@/shared/types/domain';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';
import { calculatePersonBalance } from '@/shared/utils/calculate-person-balance';
import { personCurrency } from '@/shared/utils/person-currency';
import type { Transaction } from '@/shared/types/domain';
import { formatJalaali, jalaaliOfDate } from '@/shared/utils/jalali';

export type DebtKind = 'loan' | 'bnpl' | 'person' | 'check';

export interface DebtItem {
  key: string;
  kind: DebtKind;
  id: string;
  title: string;
  /** Remaining in its own unit (currency or asset quantity). */
  remaining: number;
  /** Unit label: currency code or asset unit. */
  unit: string;
  remainingToman: number;
  /** In a foreign currency or an asset: Toman size changes with the market. */
  fx: boolean;
  /** Scheduled payments left (in Toman), ordered by date. Empty = no schedule. */
  schedule: { due: string; toman: number }[];
  nextDue: string | null;
  /** Last scheduled date: the debt ends then if paid as planned. */
  endDate: string | null;
}

export interface DebtInput {
  loans: Loan[];
  installments: LoanInstallment[];
  persons: Person[];
  transactions: Transaction[];
  checks: Check[];
  assets: Pick<Asset, 'id' | 'price_toman' | 'unit' | 'name'>[];
  currencyRates: CurrencyRate[];
  usdRate: number;
}

const rateOf = (currency: Currency, rates: CurrencyRate[], usdRate: number) =>
  currency === 'IRT' ? 1 : currency === 'USD' && usdRate > 0 ? usdRate : tomanPerUnit(currency, rates);

export function buildDebts(input: DebtInput): DebtItem[] {
  const { loans, installments, persons, transactions, checks, assets, currencyRates, usdRate } = input;
  const assetsById = new Map(assets.map((a) => [a.id, a]));
  const items: DebtItem[] = [];

  for (const loan of loans) {
    if (loan.deleted_at) continue;
    const open = installments
      .filter((i) => i.loan_id === loan.id && !i.is_paid)
      .sort((a, b) => a.due_date_string.localeCompare(b.due_date_string));
    if (open.length === 0) continue;
    const asset = loan.asset_id ? assetsById.get(loan.asset_id) : undefined;
    const unitRate = asset ? Number(asset.price_toman) || 0 : rateOf(loan.currency, currencyRates, usdRate);
    const left = (i: LoanInstallment) => Math.max(0, Number(i.amount) - Number(i.paid_amount ?? 0));
    const remaining = open.reduce((s, i) => s + left(i), 0);
    items.push({
      key: `loan:${loan.id}`,
      kind: loan.type === 'expense' ? 'bnpl' : 'loan',
      id: loan.id,
      title: loan.title,
      remaining,
      unit: asset ? asset.unit : loan.currency,
      remainingToman: remaining * unitRate,
      fx: !!asset || loan.currency !== 'IRT',
      schedule: open.map((i) => ({ due: i.due_date_string, toman: left(i) * unitRate })),
      nextDue: open[0]!.due_date_string,
      endDate: open[open.length - 1]!.due_date_string,
    });
  }

  for (const p of persons) {
    const balance = calculatePersonBalance(p, transactions);
    if (!(balance < 0)) continue;
    const cur = personCurrency(p);
    const owed = -balance;
    if (cur === 'IRT' ? owed < 1 : owed < 0.01) continue;
    items.push({
      key: `person:${p.id}`,
      kind: 'person',
      id: p.id,
      title: p.name,
      remaining: owed,
      unit: cur,
      remainingToman: owed * rateOf(cur, currencyRates, usdRate),
      fx: cur !== 'IRT',
      schedule: [],
      nextDue: null,
      endDate: null,
    });
  }

  for (const c of checks) {
    if (c.status !== 'pending' || c.deleted_at || c.is_guarantee) continue;
    const toman = Number(c.amount) * rateOf(c.currency, currencyRates, usdRate);
    items.push({
      key: `check:${c.id}`,
      kind: 'check',
      id: c.id,
      title: c.title,
      remaining: Number(c.amount),
      unit: c.currency,
      remainingToman: toman,
      fx: c.currency !== 'IRT',
      schedule: [{ due: c.due_date_string, toman }],
      nextDue: c.due_date_string,
      endDate: c.due_date_string,
    });
  }

  return items.sort((a, b) => b.remainingToman - a.remainingToman);
}

export interface DebtSummary {
  totalToman: number;
  fxToman: number;
  /** Scheduled payments due in the given Jalali month prefixes ("1405/09"). */
  dueInMonth: (monthPrefix: string) => number;
  /** Last scheduled date over all debts with a schedule. */
  debtFreeDate: string | null;
  /** Debts with no schedule (persons): no end date. */
  unscheduledToman: number;
}

export function summarizeDebts(items: DebtItem[]): DebtSummary {
  const all = items.flatMap((i) => i.schedule);
  return {
    totalToman: items.reduce((s, i) => s + i.remainingToman, 0),
    fxToman: items.filter((i) => i.fx).reduce((s, i) => s + i.remainingToman, 0),
    dueInMonth: (prefix) => all.filter((p) => p.due.startsWith(prefix)).reduce((s, p) => s + p.toman, 0),
    debtFreeDate: items.reduce<string | null>((max, i) => (i.endDate && (!max || i.endDate > max) ? i.endDate : max), null),
    unscheduledToman: items.filter((i) => i.schedule.length === 0).reduce((s, i) => s + i.remainingToman, 0),
  };
}

/**
 * Loan debt at the end of past months (installment history): an installment
 * counts as owed at a date when its loan had started and it was not paid
 * (or was paid after that date). Partial payments count only once fully paid.
 */
export function loanDebtTrend(
  input: Pick<DebtInput, 'loans' | 'installments' | 'assets' | 'currencyRates' | 'usdRate'>,
  monthEnds: string[]
): { date: string; toman: number }[] {
  const assetsById = new Map(input.assets.map((a) => [a.id, a]));
  const loans = new Map(input.loans.filter((l) => !l.deleted_at).map((l) => [l.id, l]));
  return monthEnds.map((date) => {
    let toman = 0;
    for (const i of input.installments) {
      const loan = loans.get(i.loan_id);
      if (!loan || loan.loan_start_date_string > date) continue;
      const paidAt = i.is_paid && i.paid_at ? i.paid_at.slice(0, 10) : null;
      // paid_at is an ISO (Gregorian) timestamp: compare on its Jalali day.
      if (i.is_paid && paidAt && isoDayToJalaliKey(paidAt) <= date) continue;
      const asset = loan.asset_id ? assetsById.get(loan.asset_id) : undefined;
      const rate = asset ? Number(asset.price_toman) || 0 : rateOf(loan.currency, input.currencyRates, input.usdRate);
      toman += Number(i.amount) * rate;
    }
    return { date, toman };
  });
}

function isoDayToJalaliKey(isoDay: string): string {
  const [y, m, d] = isoDay.split('-').map(Number);
  return formatJalaali(jalaaliOfDate(new Date(y!, (m ?? 1) - 1, d ?? 1)));
}

export interface PayoffResult {
  /** Month (index from now, 1 = this month) each debt is paid off. */
  months: Map<string, number>;
  /** Months until every scheduled debt is paid. */
  debtFreeMonths: number;
}

/**
 * Month-by-month payoff: every scheduled payment is paid on its month; an
 * `extraPerMonth` (Toman) goes to the smallest debt first (snowball: one less
 * payment to track sooner). Without interest data the order does not change
 * the total paid, only how fast debts disappear. Extra money pays the LAST
 * installments first, so the end date moves closer.
 */
export function simulatePayoff(items: DebtItem[], todayMonthPrefix: string, extraPerMonth: number, maxMonths = 240): PayoffResult {
  const monthKey = (prefix: string, add: number) => {
    const [y, m] = prefix.split('/').map(Number);
    const total = (m! - 1) + add;
    return `${y! + Math.floor(total / 12)}/${String(((total % 12) + 12) % 12 + 1).padStart(2, '0')}`;
  };
  type D = { key: string; payments: { month: string; toman: number }[]; open: number };
  const debts: D[] = items.map((i) => {
    const payments = i.schedule.map((p) => ({ month: p.due.slice(0, 7) < todayMonthPrefix ? todayMonthPrefix : p.due.slice(0, 7), toman: p.toman }));
    // No schedule (a person you owe): due now, paid from the extra only.
    return { key: i.key, payments, open: payments.length ? 0 : i.remainingToman };
  });
  const months = new Map<string, number>();
  let n = 0;
  for (; n < maxMonths; n++) {
    const month = monthKey(todayMonthPrefix, n);
    for (const d of debts) d.payments = d.payments.filter((p) => p.month !== month);
    let extra = extraPerMonth;
    const alive = () => debts.filter((d) => !months.has(d.key) && (d.payments.length > 0 || d.open > 0.5));
    while (extra > 0.5) {
      const target = alive().sort((a, b) => remainingOf(a) - remainingOf(b))[0];
      if (!target) break;
      if (target.open > 0) {
        const pay = Math.min(extra, target.open);
        target.open -= pay;
        extra -= pay;
        continue;
      }
      // pay the last scheduled payment first
      const last = target.payments[target.payments.length - 1]!;
      const pay = Math.min(extra, last.toman);
      last.toman -= pay;
      extra -= pay;
      if (last.toman <= 0.5) target.payments.pop();
    }
    for (const d of debts) if (!months.has(d.key) && d.payments.length === 0 && d.open <= 0.5) months.set(d.key, n + 1);
    if (months.size === debts.length) break;
  }
  return { months, debtFreeMonths: Math.max(0, ...months.values()) };

  function remainingOf(d: D) {
    return d.open + d.payments.reduce((s, p) => s + p.toman, 0);
  }
}
