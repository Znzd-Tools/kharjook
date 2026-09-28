import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import { TEHRAN_TIMEZONE } from '@/features/notifications/telegram/utils/format-debts-list';
import { formatJalaali, todayJalaaliInTimezone } from '@/shared/utils/jalali';
import { serverUsdRateOn } from '@/shared/utils/rate-history-store';
import {
  installmentPaidAmount,
  installmentRemainingAmount,
  validatePartialPayAmount,
} from '@/features/deadlines/utils/installment-remaining';
import { isAssetLoan } from '@/features/deadlines/utils/loan-amount';
import { notifyExpenseTransaction } from '@/features/notifications/services/notify-expense-transaction';
import type { Asset, Loan, LoanInstallment, Transaction, Wallet } from '@/shared/types/domain';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';

export type SettleInstallmentResult =
  | { ok: true; transactionId: string; fullyPaid: boolean }
  | { ok: false; error: string; code: 'not_found' | 'already_paid' | 'invalid' | 'db' };

export async function settleLoanInstallment(input: {
  userId: string;
  installmentId: string;
  /** Required for fiat loans. Ignored when loan is asset-denominated. */
  walletId?: string;
  /** In loan denomination (fiat units or asset qty); defaults to remaining. */
  payAmountInLoanCurrency?: number;
}): Promise<SettleInstallmentResult> {
  const admin = createSupabaseAdminClient();

  const { data: installmentRow } = await admin
    .from('loan_installments')
    .select('*')
    .eq('id', input.installmentId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (!installmentRow) {
    return { ok: false, error: 'قسط پیدا نشد.', code: 'not_found' };
  }

  const installment = installmentRow as LoanInstallment;
  if (installment.is_paid) {
    return { ok: false, error: 'این قسط قبلاً پرداخت شده.', code: 'already_paid' };
  }

  const remaining = installmentRemainingAmount(installment);
  if (!(remaining > 0)) {
    return { ok: false, error: 'این قسط قبلاً پرداخت شده.', code: 'already_paid' };
  }

  const payInLoanCurrency = input.payAmountInLoanCurrency ?? remaining;
  const amountError = validatePartialPayAmount(payInLoanCurrency, remaining);
  if (amountError) {
    return { ok: false, error: amountError, code: 'invalid' };
  }

  const { data: loanRow } = await admin
    .from('loans')
    .select('*')
    .eq('id', installment.loan_id)
    .eq('user_id', input.userId)
    .is('deleted_at', null)
    .maybeSingle();

  const loan = loanRow as Loan | null;
  if (!loan) {
    return { ok: false, error: 'اطلاعات وام نامعتبر است.', code: 'invalid' };
  }

  const { data: ratesRows } = await admin
    .from('currency_rates')
    .select('*')
    .eq('user_id', input.userId);
  const rates = ratesRows ?? [];
  const usdRate = rates.find((r) => r.currency === 'USD')?.toman_per_unit ?? 0;

  // USD snapshot at the rate of the row's date (the due date), from the
  // stored history; falls back to the current rate.
  const snapUsdRate = await serverUsdRateOn(
    admin,
    input.userId,
    installment.due_date_string,
    formatJalaali(todayJalaaliInTimezone(TEHRAN_TIMEZONE)),
    Number(usdRate)
  );

  let txPayload: Record<string, unknown>;

  if (isAssetLoan(loan)) {
    const { data: assetRow } = await admin
      .from('assets')
      .select('*')
      .eq('id', loan.asset_id!)
      .eq('user_id', input.userId)
      .maybeSingle();
    const asset = assetRow as Asset | null;
    if (!asset) {
      return { ok: false, error: 'دارایی وام پیدا نشد.', code: 'invalid' };
    }
    const priceToman = Number(asset.price_toman);
    if (!(priceToman > 0) || !(usdRate > 0)) {
      return { ok: false, error: 'قیمت دارایی برای تسویه در دسترس نیست.', code: 'invalid' };
    }
    if (!Number.isFinite(payInLoanCurrency) || payInLoanCurrency <= 0) {
      return { ok: false, error: 'مقدار تسویه نامعتبر است.', code: 'invalid' };
    }

    txPayload = {
      user_id: input.userId,
      type: 'EXPENSE',
      date_string: installment.due_date_string,
      note: loan.title,
      source_wallet_id: null,
      source_asset_id: asset.id,
      target_wallet_id: null,
      target_asset_id: null,
      source_amount: payInLoanCurrency,
      target_amount: null,
      category_id: loan.type === 'expense' ? loan.category_id : null,
      asset_id: asset.id,
      amount: payInLoanCurrency,
      price_toman: priceToman,
      usd_rate: snapUsdRate,
      amount_toman_at_time: payInLoanCurrency * priceToman,
      amount_usd_at_time: (payInLoanCurrency * priceToman) / snapUsdRate,
    };
  } else {
    if (!input.walletId) {
      return { ok: false, error: 'کیف پول پرداخت الزامی است.', code: 'invalid' };
    }

    const { data: walletRow } = await admin
      .from('wallets')
      .select('*')
      .eq('id', input.walletId)
      .eq('user_id', input.userId)
      .is('archived_at', null)
      .maybeSingle();

    const wallet = walletRow as Wallet | null;
    if (!wallet) {
      return { ok: false, error: 'اطلاعات وام یا کیف پول نامعتبر است.', code: 'invalid' };
    }

    const loanRate = tomanPerUnit(loan.currency, rates);
    const payRate = tomanPerUnit(wallet.currency, rates);

    if (loanRate <= 0 || payRate <= 0 || usdRate <= 0) {
      return { ok: false, error: 'نرخ تبدیل برای تسویه در دسترس نیست.', code: 'invalid' };
    }

    const payAmount = (payInLoanCurrency * loanRate) / payRate;
    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      return { ok: false, error: 'مبلغ تسویه نامعتبر است.', code: 'invalid' };
    }

    txPayload = {
      user_id: input.userId,
      type: 'EXPENSE',
      date_string: installment.due_date_string,
      note: loan.title,
      source_wallet_id: wallet.id,
      source_asset_id: null,
      target_wallet_id: null,
      target_asset_id: null,
      source_amount: payAmount,
      target_amount: null,
      category_id: loan.type === 'expense' ? loan.category_id : null,
      asset_id: null,
      amount: null,
      price_toman: wallet.currency === 'IRT' ? null : payRate,
      usd_rate: wallet.currency === 'IRT' ? null : snapUsdRate,
      amount_toman_at_time: payAmount * payRate,
      amount_usd_at_time: (payAmount * payRate) / snapUsdRate,
    };
  }

  const { data: txData, error: txErr } = await admin
    .from('transactions')
    .insert(txPayload)
    .select()
    .single();

  if (txErr || !txData) {
    return { ok: false, error: 'ثبت تراکنش ناموفق بود.', code: 'db' };
  }

  const createdTx = txData as Transaction;
  const actuallyNewPaid = installmentPaidAmount(installment) + payInLoanCurrency;
  const fullyPaid = actuallyNewPaid >= Number(installment.amount) - 1e-9;

  // Optimistic lock: only update if nobody paid this installment since we
  // read it. Otherwise a double tap / parallel partial pay would book two
  // expenses but record one payment.
  const { data: updatedRows, error: installmentErr } = await admin
    .from('loan_installments')
    .update({
      paid_amount: actuallyNewPaid,
      is_paid: fullyPaid,
      paid_at: fullyPaid ? new Date().toISOString() : installment.paid_at,
      paid_transaction_id: createdTx.id,
    })
    .eq('id', installment.id)
    .eq('is_paid', false)
    .eq('paid_amount', installmentPaidAmount(installment))
    .select('id');

  if (installmentErr || !updatedRows || updatedRows.length === 0) {
    // Roll back the expense so money never leaves the wallet without the
    // installment being marked.
    await admin
      .from('transactions')
      .delete()
      .eq('id', createdTx.id)
      .eq('user_id', input.userId);
    if (installmentErr) {
      return { ok: false, error: 'به‌روزرسانی قسط ناموفق بود.', code: 'db' };
    }
    return {
      ok: false,
      error: 'این قسط هم‌زمان تغییر کرد. صفحه را تازه کن و دوباره تلاش کن.',
      code: 'already_paid',
    };
  }

  await notifyExpenseTransaction(input.userId, createdTx);

  return { ok: true, transactionId: createdTx.id, fullyPaid };
}
