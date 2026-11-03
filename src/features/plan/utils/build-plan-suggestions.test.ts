import { describe, expect, it } from 'vitest';
import { buildPlanSuggestions } from '@/features/plan/utils/build-plan-suggestions';
import type { Check, Loan, LoanInstallment } from '@/shared/types/domain';
import { formatJalaali } from '@/shared/utils/jalali';
import { currentPeriod, shiftPeriod, type Period } from '@/shared/utils/period';

const loan = { id: 'l1', title: 'وام', category_id: null, currency: 'IRT', asset_id: null } as Loan;

const on = (period: Period, jd: number) =>
  formatJalaali({ jy: period.start.jy, jm: period.start.jm, jd });

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
    title: id,
    due_date_string: due,
    category_id: null,
    note: null,
  }) as Check;

describe('buildPlanSuggestions checks', () => {
  it('lists every pending check, including this month, sorted by due date', () => {
    const thisMonth = currentPeriod('month');
    const nextMonth = shiftPeriod(thisMonth, 1);
    const later = shiftPeriod(thisMonth, 4);

    const suggestions = buildPlanSuggestions({
      period: nextMonth,
      items: [],
      installments: [installment(on(nextMonth, 2), 'i-next')],
      loans: [loan],
      checks: [
        check(on(later, 3), 'c-later'),
        check(on(thisMonth, 5), 'c-now'),
        check(on(nextMonth, 4), 'c-next'),
        check(on(thisMonth, 6), 'c-cleared', 'cleared'),
      ],
      recurring: [],
      subscriptions: [],
      currencyRates: [],
    });

    expect(suggestions.map((row) => row.sourceId)).toEqual([
      'c-now',
      'i-next',
      'c-next',
      'c-later',
    ]);
  });
});
