import { describe, expect, it } from 'vitest';
import { buildPushReminders, settleRequest } from './reminders';

const days: Record<string, number> = { '1405/08/17': 0, '1405/08/18': 1, '1405/08/19': 2, '1405/08/10': -7 };
const daysUntil = (d: string) => days[d] ?? null;

describe('buildPushReminders', () => {
  it('keeps only items due today or tomorrow', () => {
    const r = buildPushReminders({
      daysUntil,
      checks: [
        { id: 'c1', title: 'رضایی', due_date_string: '1405/08/17', wallet_id: 'w1', amountLabel: '۱ ت' },
        { id: 'c2', title: 'دور', due_date_string: '1405/08/19', wallet_id: 'w1', amountLabel: '۱ ت' },
        { id: 'c3', title: 'گذشته', due_date_string: '1405/08/10', wallet_id: 'w1', amountLabel: '۱ ت' },
      ],
      installments: [{ id: 'i1', loanTitle: 'مسکن', due_date_string: '1405/08/18', amountLabel: '۵ ت' }],
      subscriptions: [{ id: 's1', platform: 'اینترنت', next_due_date_string: 'bad', wallet_id: null, amountLabel: '' }],
    });
    expect(r.map((x) => x.key)).toEqual(['check:c1:1405/08/17', 'installment:i1:1405/08/18']);
    expect(r[0]!.title).toBe('چک «رضایی» امروز');
    expect(r[1]!.title).toBe('قسط «مسکن» فردا');
  });
});

describe('settleRequest', () => {
  it('maps each kind to its settle API', () => {
    expect(settleRequest({ kind: 'check', id: 'c1', walletId: 'w1' })).toEqual({ url: '/api/checks/settle', body: { checkId: 'c1', walletId: 'w1' } });
    expect(settleRequest({ kind: 'installment', id: 'i1', walletId: null })).toEqual({ url: '/api/loans/installments/settle', body: { installmentId: 'i1' } });
    expect(settleRequest({ kind: 'subscription', id: 's1', walletId: 'w2' })).toEqual({ url: '/api/subscriptions/settle', body: { subscriptionId: 's1', walletId: 'w2' } });
  });
  it('needs a wallet for checks and subscriptions', () => {
    expect(settleRequest({ kind: 'check', id: 'c1', walletId: null })).toBeNull();
  });
});
