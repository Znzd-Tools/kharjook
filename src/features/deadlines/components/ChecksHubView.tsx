'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  Loader2,
  Plus,
  ReceiptText,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useAuth, useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { fireExpenseAlert } from '@/features/notifications/client/fire-expense-alert';
import { useToast } from '@/shared/components/Toast';
import { supabase } from '@/shared/lib/supabase/client';
import { EmptyState } from '@/shared/components/EmptyState';
import { ListSheetPicker } from '@/shared/components/ListSheetPicker';
import type { Check, CheckStatus, Transaction } from '@/shared/types/domain';
import { formatCurrency } from '@/shared/utils/format-currency';
import { formatJalaali, formatJalaaliHuman, parseJalaali, todayJalaali } from '@/shared/utils/jalali';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';
import { daysBetweenJalaali } from '@/features/notifications/utils/jalali-days';

type FilterKey = 'pending' | 'cleared' | 'all';

const STATUS_LABEL: Record<CheckStatus, string> = {
  pending: 'در انتظار',
  cleared: 'وصول شده',
  bounced: 'برگشتی',
  cancelled: 'لغو شده',
};

const toFaDigits = (value: number | string) =>
  String(value).replace(/\d/g, (c) => '۰۱۲۳۴۵۶۷۸۹'[Number(c)]!);

function checkAmountToToman(
  amount: number,
  currency: Check['currency'],
  currencyRates: ReturnType<typeof useData>['currencyRates']
): number {
  const rate = tomanPerUnit(currency, currencyRates);
  if (!(rate > 0)) return 0;
  return amount * rate;
}

function daysUntilDue(dueDateString: string, todayStr: string): number | null {
  return daysBetweenJalaali(todayStr, dueDateString);
}

export function ChecksHubView() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { wallets, categories, currencyRates, setTransactions } = useData();
  const { currencyMode, usdRate } = useUI();

  const [checks, setChecks] = useState<Check[]>([]);
  const [filter, setFilter] = useState<FilterKey>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settlementTarget, setSettlementTarget] = useState<Check | null>(null);
  const [settlementWalletId, setSettlementWalletId] = useState<string | null>(null);
  const [isSettlementPickerOpen, setIsSettlementPickerOpen] = useState(false);

  const todayStr = useMemo(() => formatJalaali(todayJalaali()), []);

  const refresh = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('checks')
        .select('*')
        .is('deleted_at', null)
        .order('due_date_string', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setChecks((data ?? []) as Check[]);
    } catch (error) {
      console.error(error);
      toast.error('خطا در دریافت چک‌ها.');
    } finally {
      setIsLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredChecks = useMemo(() => {
    if (filter === 'all') return checks;
    if (filter === 'cleared') {
      return checks.filter((check) => check.status === 'cleared' || check.status === 'bounced');
    }
    return checks.filter((check) => check.status === 'pending');
  }, [checks, filter]);

  const displayAmount = useCallback(
    (check: Check) => {
      const toman = checkAmountToToman(check.amount, check.currency, currencyRates);
      if (!(toman > 0)) return check.amount;
      if (currencyMode === 'USD' && usdRate > 0) return toman / usdRate;
      return toman;
    },
    [currencyMode, currencyRates, usdRate]
  );

  const walletItems = useMemo(
    () =>
      wallets.map((wallet) => ({
        id: wallet.id,
        label: `${wallet.name} · ${wallet.currency}`,
      })),
    [wallets]
  );

  const selectedSettlementWallet = wallets.find((wallet) => wallet.id === settlementWalletId) ?? null;

  const openSettle = (check: Check) => {
    setSettlementTarget(check);
    setSettlementWalletId(check.wallet_id ?? wallets[0]?.id ?? null);
  };

  const closeSettle = () => {
    setSettlementTarget(null);
    setSettlementWalletId(null);
  };

  const handleSettle = async () => {
    if (!settlementTarget || !settlementWalletId || !user) {
      toast.error('کیف پول پرداخت را انتخاب کن.');
      return;
    }
    const wallet = wallets.find((w) => w.id === settlementWalletId);
    if (!wallet) {
      toast.error('اطلاعات پرداخت نامعتبر است.');
      return;
    }

    const checkRate = tomanPerUnit(settlementTarget.currency, currencyRates);
    const payRate = tomanPerUnit(wallet.currency, currencyRates);
    if (checkRate <= 0 || payRate <= 0 || usdRate <= 0) {
      toast.error('نرخ تبدیل برای تسویه در دسترس نیست.');
      return;
    }

    const payAmount = (settlementTarget.amount * checkRate) / payRate;
    if (!Number.isFinite(payAmount) || payAmount <= 0) {
      toast.error('مبلغ تسویه نامعتبر است.');
      return;
    }

    const noteParts = [settlementTarget.title];
    if (settlementTarget.bank_name) noteParts.push(settlementTarget.bank_name);
    if (settlementTarget.check_number) noteParts.push(`#${settlementTarget.check_number}`);

    const txPayload: Record<string, unknown> = {
      user_id: user.id,
      type: 'EXPENSE',
      date_string: settlementTarget.due_date_string,
      note: noteParts.join(' · '),
      source_wallet_id: wallet.id,
      source_asset_id: null,
      target_wallet_id: null,
      target_asset_id: null,
      source_amount: payAmount,
      target_amount: null,
      category_id: settlementTarget.category_id,
      asset_id: null,
      amount: null,
      price_toman: wallet.currency === 'IRT' ? null : payRate,
      usd_rate: wallet.currency === 'IRT' ? null : usdRate,
      amount_toman_at_time: payAmount * payRate,
      amount_usd_at_time: (payAmount * payRate) / usdRate,
    };

    setIsSubmitting(true);
    try {
      const { data: txData, error: txErr } = await supabase
        .from('transactions')
        .insert(txPayload)
        .select()
        .single();
      if (txErr) throw txErr;
      const createdTx = txData as Transaction;

      const { error: checkErr } = await supabase
        .from('checks')
        .update({
          status: 'cleared',
          cleared_at: new Date().toISOString(),
          paid_transaction_id: createdTx.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settlementTarget.id)
        .eq('status', 'pending');
      if (checkErr) throw checkErr;

      setTransactions((prev) => [createdTx, ...prev]);
      fireExpenseAlert([createdTx.id]);
      toast.success('چک تسویه شد و تراکنش ثبت شد.');
      closeSettle();
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error('خطا در تسویه چک.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMarkBounced = async (check: Check) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('checks')
        .update({ status: 'bounced', updated_at: new Date().toISOString() })
        .eq('id', check.id)
        .eq('status', 'pending');
      if (error) throw error;
      toast.success('چک به‌عنوان برگشتی ثبت شد.');
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error('خطا در ثبت برگشت چک.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (check: Check) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('checks')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', check.id);
      if (error) throw error;
      toast.success('چک حذف شد.');
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error('خطا در حذف چک.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">چک‌ها</h2>
        <button
          type="button"
          onClick={() => router.push('/deadlines/checks/new')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          چک جدید
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1 bg-[#1A1B26] p-1 rounded-xl">
        {(
          [
            ['pending', 'در انتظار'],
            ['cleared', 'وصول/برگشت'],
            ['all', 'همه'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`py-2 text-xs font-bold rounded-lg transition-all ${
              filter === key ? 'bg-purple-600 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center text-slate-500 py-10 animate-pulse">در حال دریافت...</div>
      ) : filteredChecks.length === 0 ? (
        <EmptyState
          icon={<ReceiptText size={24} />}
          title={filter === 'pending' ? 'چک در انتظاری ندارید.' : 'موردی برای نمایش نیست.'}
          description={
            filter === 'pending'
              ? 'چک‌های صادره را با تاریخ سررسید ثبت کنید تا سررسید را از دست ندهید.'
              : undefined
          }
          actionLabel={filter === 'pending' ? 'ثبت اولین چک' : undefined}
          onAction={filter === 'pending' ? () => router.push('/deadlines/checks/new') : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filteredChecks.map((check) => {
            const category = check.category_id
              ? categories.find((c) => c.id === check.category_id)
              : null;
            const due = parseJalaali(check.due_date_string);
            const days = daysUntilDue(check.due_date_string, todayStr);
            const isOverdue = check.status === 'pending' && days != null && days < 0;
            const isToday = check.status === 'pending' && days === 0;

            return (
              <div
                key={check.id}
                className="bg-[#1A1B26] border border-white/5 p-4 rounded-2xl space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-100 truncate">{check.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {[check.bank_name, check.check_number ? `#${check.check_number}` : null, category?.name]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] px-2 py-1 rounded-lg shrink-0 ${
                      check.status === 'pending'
                        ? isOverdue
                          ? 'bg-rose-500/15 text-rose-300'
                          : isToday
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-sky-500/15 text-sky-300'
                        : check.status === 'cleared'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : check.status === 'bounced'
                            ? 'bg-rose-500/15 text-rose-300'
                            : 'bg-slate-500/15 text-slate-400'
                    }`}
                  >
                    {STATUS_LABEL[check.status]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/3 rounded-xl p-2.5">
                    <p className="text-slate-500">مبلغ</p>
                    <p className="text-slate-200 mt-1" dir="ltr">
                      {formatCurrency(displayAmount(check), currencyMode)}
                    </p>
                  </div>
                  <div className="bg-white/3 rounded-xl p-2.5">
                    <p className="text-slate-500">سررسید</p>
                    <p className="text-slate-200 mt-1">
                      {due ? toFaDigits(formatJalaaliHuman(due)) : check.due_date_string}
                    </p>
                  </div>
                </div>

                {check.status === 'pending' && (
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => openSettle(check)}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition disabled:opacity-50"
                    >
                      <CreditCard size={13} />
                      تسویه
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleMarkBounced(check)}
                      className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition disabled:opacity-50"
                    >
                      <XCircle size={13} />
                      برگشت
                    </button>
                    <Link
                      href={`/deadlines/checks/${check.id}/edit`}
                      className="text-[12px] px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition"
                    >
                      ویرایش
                    </Link>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleDelete(check)}
                      className="text-[12px] px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition disabled:opacity-50"
                    >
                      <span className="inline-flex items-center gap-1">
                        <Trash2 size={13} />
                        حذف
                      </span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ListSheetPicker
        open={isSettlementPickerOpen}
        onClose={() => setIsSettlementPickerOpen(false)}
        title="انتخاب کیف پول پرداخت"
        items={walletItems}
        value={settlementWalletId}
        onSelect={(id) => {
          setSettlementWalletId(id);
          setIsSettlementPickerOpen(false);
        }}
      />

      {settlementTarget && (
        <div className="fixed inset-x-0 bottom-24 px-6 sm:max-w-md sm:mx-auto z-40">
          <div className="bg-[#13141C] border border-white/10 rounded-2xl p-3 shadow-2xl flex items-center gap-2">
            <button
              type="button"
              onClick={handleSettle}
              disabled={isSubmitting || !settlementWalletId}
              className="flex-1 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 size={14} className="animate-spin" />
                  در حال تسویه...
                </span>
              ) : selectedSettlementWallet ? (
                `ثبت تسویه با ${selectedSettlementWallet.name}`
              ) : (
                'ثبت تسویه'
              )}
            </button>
            <button
              type="button"
              onClick={() => setIsSettlementPickerOpen(true)}
              disabled={isSubmitting}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm disabled:opacity-50"
            >
              {selectedSettlementWallet ? selectedSettlementWallet.name : 'انتخاب کیف پول'}
            </button>
            <button
              type="button"
              onClick={closeSettle}
              className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm"
            >
              انصراف
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
