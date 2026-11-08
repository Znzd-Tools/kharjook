/**
 * Which deadlines get a push today (UX plan S30): due today or tomorrow,
 * not paid yet. Pure, so it is unit-tested; the cron does the I/O.
 */
export type PushKind = 'check' | 'installment' | 'subscription';

export interface PushReminder {
  kind: PushKind;
  id: string;
  title: string;
  body: string;
  dueDateString: string;
  /** Wallet the "پرداخت شد" action pays from (required for checks and subscriptions). */
  walletId: string | null;
  /** Dedup key: one push per item per due date. */
  key: string;
}

export interface ReminderInput {
  checks: { id: string; title: string; due_date_string: string; wallet_id: string | null; amountLabel: string }[];
  installments: { id: string; loanTitle: string; due_date_string: string; amountLabel: string }[];
  subscriptions: { id: string; platform: string; next_due_date_string: string; wallet_id: string | null; amountLabel: string }[];
  /** Days from today to a Jalaali date, or null if unreadable. */
  daysUntil: (dateString: string) => number | null;
}

const when = (d: number) => (d === 0 ? 'امروز' : 'فردا');

export function buildPushReminders({ checks, installments, subscriptions, daysUntil }: ReminderInput): PushReminder[] {
  const out: PushReminder[] = [];
  const soon = (date: string) => {
    const d = daysUntil(date);
    return d === 0 || d === 1 ? d : null;
  };
  for (const c of checks) {
    const d = soon(c.due_date_string);
    if (d == null) continue;
    out.push({
      kind: 'check', id: c.id, dueDateString: c.due_date_string, walletId: c.wallet_id,
      title: `چک «${c.title}» ${when(d)}`, body: `${c.amountLabel} · سررسید ${c.due_date_string}`,
      key: `check:${c.id}:${c.due_date_string}`,
    });
  }
  for (const i of installments) {
    const d = soon(i.due_date_string);
    if (d == null) continue;
    out.push({
      kind: 'installment', id: i.id, dueDateString: i.due_date_string, walletId: null,
      title: `قسط «${i.loanTitle}» ${when(d)}`, body: `${i.amountLabel} · سررسید ${i.due_date_string}`,
      key: `installment:${i.id}:${i.due_date_string}`,
    });
  }
  for (const s of subscriptions) {
    const d = soon(s.next_due_date_string);
    if (d == null) continue;
    out.push({
      kind: 'subscription', id: s.id, dueDateString: s.next_due_date_string, walletId: s.wallet_id,
      title: `اشتراک «${s.platform}» ${when(d)}`, body: `${s.amountLabel} · سررسید ${s.next_due_date_string}`,
      key: `subscription:${s.id}:${s.next_due_date_string}`,
    });
  }
  return out;
}

/** Endpoint + body the service worker posts when "پرداخت شد" is tapped. */
export function settleRequest(r: Pick<PushReminder, 'kind' | 'id' | 'walletId'>): { url: string; body: Record<string, string> } | null {
  if (r.kind === 'installment') return { url: '/api/loans/installments/settle', body: { installmentId: r.id, ...(r.walletId ? { walletId: r.walletId } : {}) } };
  if (!r.walletId) return null;
  if (r.kind === 'check') return { url: '/api/checks/settle', body: { checkId: r.id, walletId: r.walletId } };
  return { url: '/api/subscriptions/settle', body: { subscriptionId: r.id, walletId: r.walletId } };
}
