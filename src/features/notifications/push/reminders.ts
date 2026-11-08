/**
 * Which deadlines get a push today: due today (per type switch) or on one
 * of the item's "N days before" (advance switch), not paid yet. Pure, so it is unit-tested; the cron does the I/O.
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
  checks: { id: string; title: string; due_date_string: string; wallet_id: string | null; amountLabel: string; reminderDays?: number[] }[];
  installments: { id: string; loanTitle: string; due_date_string: string; amountLabel: string; reminderDays?: number[] }[];
  subscriptions: { id: string; platform: string; next_due_date_string: string; wallet_id: string | null; amountLabel: string; reminderDays?: number[] }[];
  /** Days from today to a Jalaali date, or null if unreadable. */
  daysUntil: (dateString: string) => number | null;
  /** Notification center switches (push channel). Default: all on. */
  prefs?: { dueToday: Record<PushKind, boolean>; advance: boolean };
}

const when = (d: number) => (d === 0 ? 'امروز' : d === 1 ? 'فردا' : `${d.toLocaleString('fa-IR')} روز دیگر`);

export function buildPushReminders({ checks, installments, subscriptions, daysUntil, prefs }: ReminderInput): PushReminder[] {
  const out: PushReminder[] = [];
  const p = prefs ?? { dueToday: { check: true, installment: true, subscription: true }, advance: true };
  /** Same day (if that type is on) or one of the item's "N days before" (if advance is on). */
  const at = (kind: PushKind, date: string, days: number[] | undefined) => {
    const d = daysUntil(date);
    if (d === 0) return p.dueToday[kind] ? 0 : null;
    if (d != null && d > 0 && p.advance && (days ?? [2]).includes(d)) return d;
    return null;
  };
  for (const c of checks) {
    const d = at('check', c.due_date_string, c.reminderDays);
    if (d == null) continue;
    out.push({
      kind: 'check', id: c.id, dueDateString: c.due_date_string, walletId: c.wallet_id,
      title: `چک «${c.title}» ${when(d)}`, body: `${c.amountLabel} · سررسید ${c.due_date_string}`,
      key: `check:${c.id}:${c.due_date_string}:${d}`,
    });
  }
  for (const i of installments) {
    const d = at('installment', i.due_date_string, i.reminderDays);
    if (d == null) continue;
    out.push({
      kind: 'installment', id: i.id, dueDateString: i.due_date_string, walletId: null,
      title: `قسط «${i.loanTitle}» ${when(d)}`, body: `${i.amountLabel} · سررسید ${i.due_date_string}`,
      key: `installment:${i.id}:${i.due_date_string}:${d}`,
    });
  }
  for (const s of subscriptions) {
    const d = at('subscription', s.next_due_date_string, s.reminderDays);
    if (d == null) continue;
    out.push({
      kind: 'subscription', id: s.id, dueDateString: s.next_due_date_string, walletId: s.wallet_id,
      title: `اشتراک «${s.platform}» ${when(d)}`, body: `${s.amountLabel} · سررسید ${s.next_due_date_string}`,
      key: `subscription:${s.id}:${s.next_due_date_string}:${d}`,
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
