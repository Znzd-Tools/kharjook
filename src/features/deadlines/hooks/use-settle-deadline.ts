'use client';

/**
 * One-tap "paid" for a timeline item with exact undo. Uses the same
 * server services as the Telegram bot (via API routes); undo deletes the
 * expense and restores exactly the fields the payment changed.
 * Shared by the برنامه tab and the dashboard.
 */
import { useState } from 'react';
import { toast } from '@/design-system';
import { supabase } from '@/shared/lib/supabase/client';
import { useData } from '@/features/portfolio/PortfolioProvider';
import type { TimelineItem } from '@/features/deadlines/utils/timeline';

const KIND_LABEL = { check: 'چک', installment: 'قسط', subscription: 'اشتراک' } as const;

type Snapshot =
  | { kind: 'check'; id: string; status: string; cleared_at: string | null; paid_transaction_id: string | null }
  | { kind: 'installment'; id: string; paid_amount: number; is_paid: boolean; paid_at: string | null; paid_transaction_id: string | null }
  | { kind: 'subscription'; id: string; next_due_date_string: string };

export function useSettleDeadline(onChanged?: () => Promise<void> | void) {
  const { checks, activeSubscriptions, upcomingDeadlines, refresh } = useData();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const loadLoans = async () => {
    await onChanged?.();
  };

  const snapshotOf = (item: TimelineItem): Snapshot | null => {
    if (item.kind === 'check') {
      const c = checks.find((x) => x.id === item.id);
      return c ? { kind: 'check', id: c.id, status: c.status, cleared_at: c.cleared_at, paid_transaction_id: c.paid_transaction_id } : null;
    }
    if (item.kind === 'installment') {
      const i = upcomingDeadlines.find((x) => x.id === item.id);
      return i
        ? { kind: 'installment', id: i.id, paid_amount: Number(i.paid_amount), is_paid: i.is_paid, paid_at: i.paid_at, paid_transaction_id: i.paid_transaction_id }
        : null;
    }
    const s = activeSubscriptions.find((x) => x.id === item.id);
    return s ? { kind: 'subscription', id: s.id, next_due_date_string: s.next_due_date_string } : null;
  };

  const undo = async (snap: Snapshot, transactionId: string) => {
    // Delete the expense first (subscription_payments rows cascade), then
    // restore exactly the fields the settle changed.
    const del = await supabase.from('transactions').delete().eq('id', transactionId);
    if (del.error) {
      toast.error('برگرداندن انجام نشد');
      return;
    }
    if (snap.kind === 'check') {
      await supabase.from('checks').update({ status: snap.status, cleared_at: snap.cleared_at, paid_transaction_id: snap.paid_transaction_id }).eq('id', snap.id);
    } else if (snap.kind === 'installment') {
      await supabase
        .from('loan_installments')
        .update({ paid_amount: snap.paid_amount, is_paid: snap.is_paid, paid_at: snap.paid_at, paid_transaction_id: snap.paid_transaction_id })
        .eq('id', snap.id);
    } else {
      await supabase.from('subscription_payments').delete().eq('transaction_id', transactionId);
      await supabase.from('subscriptions').update({ next_due_date_string: snap.next_due_date_string }).eq('id', snap.id);
    }
    await Promise.all([refresh(), loadLoans()]);
    toast.success('پرداخت برگشت');
  };

  /** Returns the new transaction id when the payment was saved. */
  const pay = async (item: TimelineItem, walletId: string | null, amount?: number): Promise<string | undefined> => {
    const snap = snapshotOf(item);
    if (!snap) return;
    if (!walletId && !item.assetId) {
      toast.warning('یک کیف پول بساز تا بتوانی پرداخت کنی');
      return;
    }
    setBusyKey(item.key);
    const url =
      item.kind === 'check' ? '/api/checks/settle' : item.kind === 'installment' ? '/api/loans/installments/settle' : '/api/subscriptions/settle';
    const body =
      item.kind === 'check'
        ? { checkId: item.id, walletId }
        : item.kind === 'installment'
          ? { installmentId: item.id, walletId: walletId ?? undefined, amount }
          : { subscriptionId: item.id, walletId };
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as { error?: string; transactionId?: string };
      if (!res.ok || !json.transactionId) {
        toast.error(json.error ?? 'پرداخت ثبت نشد');
        return;
      }
      await Promise.all([refresh(), loadLoans()]);
      const txId = json.transactionId;
      toast.success(`${KIND_LABEL[item.kind]} «${item.title}» پرداخت شد`, {
        action: { label: 'برگردان', onClick: () => void undo(snap, txId) },
      });
      return txId;
    } finally {
      setBusyKey(null);
    }
  };

  return { pay, busyKey };
}
