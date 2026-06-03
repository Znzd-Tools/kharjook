import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import type { Check, Transaction, Wallet } from '@/shared/types/domain';
import { notifyExpenseTransaction } from '@/features/notifications/services/notify-expense-transaction';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';

export type SettleCheckResult =
  | { ok: true; transactionId: string }
  | { ok: false; error: string; code: 'not_found' | 'already_cleared' | 'invalid' | 'db' };

export async function settleCheck(input: {
  userId: string;
  checkId: string;
  walletId: string;
}): Promise<SettleCheckResult> {
  const admin = createSupabaseAdminClient();

  const { data: checkRow } = await admin
    .from('checks')
    .select('*')
    .eq('id', input.checkId)
    .eq('user_id', input.userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (!checkRow) {
    return { ok: false, error: 'چک پیدا نشد.', code: 'not_found' };
  }

  const check = checkRow as Check;
  if (check.status !== 'pending') {
    return { ok: false, error: 'این چک قبلاً تسویه شده.', code: 'already_cleared' };
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

  const rates = ratesRows ?? [];
  const usdRate = rates.find((r) => r.currency === 'USD')?.toman_per_unit ?? 0;
  const checkRate = tomanPerUnit(check.currency, rates);
  const payRate = tomanPerUnit(wallet.currency, rates);

  if (checkRate <= 0 || payRate <= 0 || usdRate <= 0) {
    return { ok: false, error: 'نرخ تبدیل برای تسویه در دسترس نیست.', code: 'invalid' };
  }

  const payAmount = (check.amount * checkRate) / payRate;
  if (!Number.isFinite(payAmount) || payAmount <= 0) {
    return { ok: false, error: 'مبلغ تسویه نامعتبر است.', code: 'invalid' };
  }

  const noteParts = [check.title];
  if (check.bank_name) noteParts.push(check.bank_name);
  if (check.check_number) noteParts.push(`#${check.check_number}`);

  const txPayload: Record<string, unknown> = {
    user_id: input.userId,
    type: 'EXPENSE',
    date_string: check.due_date_string,
    note: noteParts.join(' · '),
    source_wallet_id: wallet.id,
    source_asset_id: null,
    target_wallet_id: null,
    target_asset_id: null,
    source_amount: payAmount,
    target_amount: null,
    category_id: check.category_id,
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
  const { error: checkErr } = await admin
    .from('checks')
    .update({
      status: 'cleared',
      cleared_at: new Date().toISOString(),
      paid_transaction_id: createdTx.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', check.id)
    .eq('status', 'pending');

  if (checkErr) {
    return { ok: false, error: 'به‌روزرسانی چک ناموفق بود.', code: 'db' };
  }

  await notifyExpenseTransaction(input.userId, createdTx);

  return { ok: true, transactionId: createdTx.id };
}
