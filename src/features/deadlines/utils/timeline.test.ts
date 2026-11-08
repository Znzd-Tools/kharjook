import { describe, expect, it } from 'vitest';
import type { Check, LoanInstallment, Subscription } from '@/shared/types/domain';
import { bucketFor, buildTimeline, daysLeftLabel } from './timeline';

const today = { jy: 1405, jm: 8, jd: 17 };
const check = (id: string, due: string, status = 'pending'): Check =>
  ({ id, title: id, due_date_string: due, amount: 100, currency: 'IRT', wallet_id: 'w', status, deleted_at: null }) as Check;
const inst = (id: string, due: string, amount: number, paid = 0, is_paid = false) =>
  ({ id, loan_id: 'l', due_date_string: due, amount, paid_amount: paid, is_paid, loanTitle: 'وام', loanCurrency: 'IRT' }) as unknown as LoanInstallment & { loanTitle: string };
const sub = (id: string, due: string): Subscription =>
  ({ id, platform: id, next_due_date_string: due, amount: 5, currency: 'USD', wallet_id: null, status: 'active', deleted_at: null }) as Subscription;

describe('bucketFor', () => {
  it('splits overdue, next 7 days, rest of month, later', () => {
    expect(bucketFor('1405/08/10', today)).toBe('overdue');
    expect(bucketFor('1405/08/17', today)).toBe('week');
    expect(bucketFor('1405/08/24', today)).toBe('week');
    expect(bucketFor('1405/08/28', today)).toBe('month');
    expect(bucketFor('1405/09/02', today)).toBe('later');
  });
});

describe('buildTimeline', () => {
  it('merges, skips paid/cleared, uses remaining amount, sorts by date', () => {
    const items = buildTimeline(
      {
        checks: [check('c1', '1405/08/19'), check('c2', '1405/08/01', 'cleared')],
        installments: [inst('i1', '1405/08/18', 5_000_000, 2_000_000), inst('i2', '1405/07/18', 5_000_000, 5_000_000, true)],
        subscriptions: [sub('s1', '1405/08/15')],
      },
      today
    );
    expect(items.map((i) => i.key)).toEqual(['subscription:s1', 'installment:i1', 'check:c1']);
    expect(items[1]).toMatchObject({ amount: 3_000_000, partial: true, daysLeft: 1 });
    expect(items[0]).toMatchObject({ bucket: 'overdue', daysLeft: -2, currency: 'USD' });
  });
});

describe('daysLeftLabel', () => {
  it('reads naturally', () => {
    expect(daysLeftLabel(0)).toBe('امروز');
    expect(daysLeftLabel(1)).toBe('فردا');
    expect(daysLeftLabel(-3)).toBe('۳ روز گذشته');
  });
});
