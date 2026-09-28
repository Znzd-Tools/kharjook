import { describe, expect, it } from 'vitest';
import { subscriptionDueDatesInPeriod } from '@/features/plan/utils/recurring-due-in-period';
import type { Subscription } from '@/shared/types/domain';

const sub = (next: string): Subscription => ({
  id: 's1',
  user_id: 'u1',
  platform: 'x',
  amount: 1,
  currency: 'IRT',
  interval_number: 1,
  interval_period: 'month',
  next_due_date_string: next,
  wallet_id: null,
  category_id: null,
  status: 'active',
  cancelled_at: null,
  reminder_days_before: [],
  note: null,
  deleted_at: null,
  created_at: '',
  updated_at: '',
});

describe('subscriptionDueDatesInPeriod', () => {
  it('projects month-end dates without drift', () => {
    const period = {
      kind: 'month' as const,
      start: { jy: 1404, jm: 1, jd: 1 },
      end: { jy: 1404, jm: 1, jd: 31 },
    };
    expect(subscriptionDueDatesInPeriod(sub('1403/06/31'), period)).toEqual(['1404/01/31']);
  });

  it('returns the anchor when it is inside the period', () => {
    const period = {
      kind: 'month' as const,
      start: { jy: 1403, jm: 7, jd: 1 },
      end: { jy: 1403, jm: 7, jd: 30 },
    };
    expect(subscriptionDueDatesInPeriod(sub('1403/07/15'), period)).toEqual(['1403/07/15']);
  });
});
