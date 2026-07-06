import { addIntervalDate } from '@/features/deadlines/utils/schedule';
import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import { notifyExpenseTransaction } from '@/features/notifications/services/notify-expense-transaction';
import type {
  Currency,
  CurrencyRate,
  LoanIntervalPeriod,
  Subscription,
  Transaction,
  Wallet,
} from '@/shared/types/domain';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';
import { formatJalaali, parseJalaali } from '@/shared/utils/jalali';

export type SettleSubscriptionResult =
  | { ok: true; transactionId: string; nextDueDateString: string }
  | { ok: false; error: string; code: 'not_found' | 'inactive' | 'invalid' | 'already_paid' | 'db' };

/** Pure helper — advance one billing interval from a Jalali due date string. */
export function advanceDueDateString(
  dueDateString: string,
  intervalNumber: number,
  intervalPeriod: LoanIntervalPeriod
): string | null {
  const parsed = parseJalaali(dueDateString);
  if (!parsed) return null;
  return formatJalaali(addIntervalDate(parsed, intervalNumber, intervalPeriod));
}

/** Pure helper — convert subscription amount to wallet currency at settle time. */
export function computeSettlePayAmount(
  amountInSubscriptionCurrency: number,
  subscriptionCurrency: Currency,
  walletCurrency: Currency,
  rates: CurrencyRate[]
): number | null {
  const subscriptionRate = tomanPerUnit(subscriptionCurrency, rates);
  const walletRate = tomanPerUnit(walletCurrency, rates);
  if (subscriptionRate <= 0 || walletRate <= 0) return null;
  const payAmount = (amountInSubscriptionCurrency * subscriptionRate) / walletRate;
  if (!Number.isFinite(payAmount) || payAmount <= 0) return null;
  return payAmount;
}

export async function settleSubscription(input: {
  userId: string;
  subscriptionId: string;
  walletId: string;
}): Promise<SettleSubscriptionResult> {
  const admin = createSupabaseAdminClient();

  const { data: subscriptionRow } = await admin
    .from('subscriptions')
    .select('*')
    .eq('id', input.subscriptionId)
    .eq('user_id', input.userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!subscriptionRow) {
    return { ok: false, error: 'اشتراک پیدا نشد.', code: 'not_found' };
  }

  const subscription = subscriptionRow as Subscription;
  if (subscription.status !== 'active') {
    return { ok: false, error: 'این اشتراک فعال نیست.', code: 'inactive' };
  }

  const dueDateString = subscription.next_due_date_string;

  const { data: existingPayment } = await admin
    .from('subscription_payments')
    .select('id')
    .eq('subscription_id', subscription.id)
    .eq('due_date_string', dueDateString)
    .maybeSingle();

  if (existingPayment) {
    return { ok: false, error: 'این دوره قبلاً پرداخت شده.', code: 'already_paid' };
  }

  const [{ data: walletRow }, { data: ratesRows }] = await Promise.all([
    admin
      .from('wallets')
      .select('*')
      .eq('id', input.walletId)
      .eq('user_id', input.userId)
      .is('archived_at', null)
      .maybeSingle(),
    admin.from('currency_rates').select('*').eq('user_id', input.userId),
  ]);

  const wallet = walletRow as Wallet | null;
  if (!wallet) {
    return { ok: false, error: 'کیف پول نامعتبر است.', code: 'invalid' };
  }

  const rates = (ratesRows ?? []) as CurrencyRate[];
  const usdRate = rates.find((r) => r.currency === 'USD')?.toman_per_unit ?? 0;
  const payAmount = computeSettlePayAmount(
    Number(subscription.amount),
    subscription.currency,
    wallet.currency,
    rates
  );

  if (payAmount == null || usdRate <= 0) {
    return { ok: false, error: 'نرخ تبدیل برای تسویه در دسترس نیست.', code: 'invalid' };
  }

  const payRate = tomanPerUnit(wallet.currency, rates);
  const nextDueDateString = advanceDueDateString(
    dueDateString,
    subscription.interval_number,
    subscription.interval_period
  );

  if (!nextDueDateString) {
    return { ok: false, error: 'تاریخ سررسید بعدی نامعتبر است.', code: 'invalid' };
  }

  const txPayload: Record<string, unknown> = {
    user_id: input.userId,
    type: 'EXPENSE',
    date_string: dueDateString,
    note: subscription.platform,
    source_wallet_id: wallet.id,
    source_asset_id: null,
    target_wallet_id: null,
    target_asset_id: null,
    source_amount: payAmount,
    target_amount: null,
    category_id: subscription.category_id,
    asset_id: null,
    amount: null,
    price_toman: wallet.currency === 'IRT' ? null : payRate,
    usd_rate: wallet.currency === 'IRT' ? null : usdRate,
    amount_toman_at_time: payAmount * payRate,
    amount_usd_at_time: (payAmount * payRate) / usdRate,
  };

  const { data: txData, error: txErr } = await admin
    .from('transactions')
    .insert(txPayload)
    .select()
    .single();

  if (txErr || !txData) {
    return { ok: false, error: 'ثبت تراکنش ناموفق بود.', code: 'db' };
  }

  const createdTx = txData as Transaction;

  const { error: paymentErr } = await admin.from('subscription_payments').insert({
    user_id: input.userId,
    subscription_id: subscription.id,
    due_date_string: dueDateString,
    amount: subscription.amount,
    currency: subscription.currency,
    transaction_id: createdTx.id,
  });

  if (paymentErr) {
    return { ok: false, error: 'ثبت پرداخت اشتراک ناموفق بود.', code: 'db' };
  }

  const { error: subErr } = await admin
    .from('subscriptions')
    .update({
      next_due_date_string: nextDueDateString,
      updated_at: new Date().toISOString(),
    })
    .eq('id', subscription.id)
    .eq('status', 'active');

  if (subErr) {
    return { ok: false, error: 'به‌روزرسانی اشتراک ناموفق بود.', code: 'db' };
  }

  await notifyExpenseTransaction(input.userId, createdTx);

  return { ok: true, transactionId: createdTx.id, nextDueDateString };
}
