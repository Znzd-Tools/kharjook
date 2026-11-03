import { describe, expect, it } from 'vitest';
import { buildPlanSuggestions } from '@/features/plan/utils/build-plan-suggestions';
import type { Check, Loan, LoanInstallment } from '@/shared/types/domain';

const month = {
  kind: 'month' as const,
  start: { jy: 1404, jm: 8, jd: 1 },
  end: { jy: 1404, jm: 8, jd: 30 },
};

const loan = { id: 'l1', title: 'وام', category_id: null, currency: 'IRT', asset_id: null } as Loan;

const installment = (due: string, id: string) =>
  ({
    id,
    loan_id: 'l1',
    is_paid: false,
    amount: 100,
    paid_amount: 0,
    due_date_string: due,
    sequence_no: 1,
    note: null,
  }) as LoanInstallment;

const check = (due: string, id: string, status: Check['status'] = 'pending') =>
  ({
    id,
    status,
    deleted_at: null,
    amount: 500,
    currency: 'IRT',
    title: 'چک اجاره',
    due_date_string: due,
    category_id: null,
    note: null,
  }) as Check;

describe('buildPlanSuggestions checks', () => {
  it('includes pending checks for the selected month and the next month', () => {
    const suggestions = buildPlanSuggestions({
      period: month,
      items: [],
      installments: [
        installment('1404/08/05', 'i1'),
        installment('1404/09/01', 'i2'),
        installment('1404/10/01', 'i3'),
      ],
      loans: [loan],
      checks: [
        check('1404/08/10', 'c1'),
        check('1404/09/02', 'c2'),
        check('1404/10/02', 'c4'),
        check('1404/08/12', 'c3', 'cleared'),
      ],
      recurring: [],
      subscriptions: [],
      currencyRates: [],
    });

    expect(suggestions.map((row) => row.sourceId)).toEqual(['i1', 'i2', 'c1', 'c2']);
  });
});
