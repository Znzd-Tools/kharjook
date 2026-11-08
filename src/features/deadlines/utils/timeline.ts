/**
 * One upcoming timeline for checks, loan installments and subscriptions
 * (UX plan S18). Pure, tested.
 */
import type { Check, Currency, LoanInstallment, Subscription } from '@/shared/types/domain';
import { addDays, formatJalaali, type JalaaliDate } from '@/shared/utils/jalali';
import { installmentRemainingAmount } from './installment-remaining';

export type TimelineKind = 'check' | 'installment' | 'subscription';
export type TimelineBucket = 'overdue' | 'week' | 'month' | 'later';

export interface TimelineItem {
  key: string;
  kind: TimelineKind;
  id: string;
  title: string;
  due: string;
  /** Remaining amount in `currency`, or asset quantity when `assetId` is set. */
  amount: number;
  currency: Currency;
  assetId: string | null;
  /** Wallet saved on the item (default for one-tap pay), if any. */
  walletId: string | null;
  bucket: TimelineBucket;
  /** Days from today; negative = overdue. */
  daysLeft: number;
  partial: boolean;
  /** Category of the check, subscription or loan (for filters). */
  categoryId: string | null;
}

type InstallmentWithLoan = LoanInstallment & {
  loanTitle?: string;
  loanCurrency?: Currency;
  loanAssetId?: string | null;
  loanWalletId?: string | null;
  loanCategoryId?: string | null;
};

function daysBetween(fromStr: string, toStr: string, today: JalaaliDate): number {
  // Small, exact walk: due dates are close to today in practice.
  if (toStr === fromStr) return 0;
  const step = toStr > fromStr ? 1 : -1;
  let d = today;
  for (let i = 1; i <= 800; i++) {
    d = addDays(d, step);
    if (formatJalaali(d) === toStr) return i * step;
  }
  return step * 801;
}

export function bucketFor(due: string, today: JalaaliDate): TimelineBucket {
  const t = formatJalaali(today);
  if (due < t) return 'overdue';
  if (due <= formatJalaali(addDays(today, 7))) return 'week';
  const monthEnd = `${today.jy}/${String(today.jm).padStart(2, '0')}/31`;
  if (due <= monthEnd) return 'month';
  return 'later';
}

export function buildTimeline(
  input: { checks: Check[]; installments: InstallmentWithLoan[]; subscriptions: Subscription[] },
  today: JalaaliDate
): TimelineItem[] {
  const t = formatJalaali(today);
  const items: TimelineItem[] = [];
  for (const c of input.checks) {
    if (c.status !== 'pending' || c.deleted_at) continue;
    items.push({
      key: `check:${c.id}`, kind: 'check', id: c.id, title: c.title, due: c.due_date_string,
      amount: Number(c.amount), currency: c.currency, assetId: null, walletId: c.wallet_id,
      bucket: bucketFor(c.due_date_string, today), daysLeft: daysBetween(t, c.due_date_string, today), partial: false,
      categoryId: c.category_id ?? null,
    });
  }
  for (const i of input.installments) {
    if (i.is_paid) continue;
    const remaining = installmentRemainingAmount(i);
    if (!(remaining > 0)) continue;
    items.push({
      key: `installment:${i.id}`, kind: 'installment', id: i.id, title: i.loanTitle ?? 'قسط',
      due: i.due_date_string, amount: remaining, currency: i.loanCurrency ?? 'IRT', assetId: i.loanAssetId ?? null,
      walletId: i.loanWalletId ?? null, bucket: bucketFor(i.due_date_string, today),
      daysLeft: daysBetween(t, i.due_date_string, today), partial: Number(i.paid_amount) > 0,
      categoryId: i.loanCategoryId ?? null,
    });
  }
  for (const s of input.subscriptions) {
    if (s.status !== 'active' || s.deleted_at) continue;
    items.push({
      key: `subscription:${s.id}`, kind: 'subscription', id: s.id, title: s.platform, due: s.next_due_date_string,
      amount: Number(s.amount), currency: s.currency, assetId: null, walletId: s.wallet_id,
      bucket: bucketFor(s.next_due_date_string, today), daysLeft: daysBetween(t, s.next_due_date_string, today), partial: false,
      categoryId: s.category_id ?? null,
    });
  }
  return items.sort((a, b) => a.due.localeCompare(b.due) || a.key.localeCompare(b.key));
}

export const BUCKET_LABEL: Record<TimelineBucket, string> = {
  overdue: 'گذشته از سررسید',
  week: '۷ روز آینده',
  month: 'بقیه این ماه',
  later: 'بعداً',
};

export function daysLeftLabel(days: number): string {
  if (days === 0) return 'امروز';
  if (days === 1) return 'فردا';
  if (days === -1) return 'دیروز';
  const n = Math.abs(days).toLocaleString('fa-IR');
  return days < 0 ? `${n} روز گذشته` : `${n} روز دیگر`;
}
