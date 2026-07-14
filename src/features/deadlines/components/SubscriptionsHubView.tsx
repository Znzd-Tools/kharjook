'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Loader2,
  Plus,
  Repeat,
  RotateCcw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useAuth, useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { useToast } from '@/shared/components/Toast';
import { supabase } from '@/shared/lib/supabase/client';
import { EmptyState } from '@/shared/components/EmptyState';
import { ListSheetPicker } from '@/shared/components/ListSheetPicker';
import type { Subscription, SubscriptionStatus, Transaction } from '@/shared/types/domain';
import { formatCurrency } from '@/shared/utils/format-currency';
import { formatJalaali, formatJalaaliHuman, parseJalaali, todayJalaali } from '@/shared/utils/jalali';
import { daysBetweenJalaali } from '@/features/notifications/utils/jalali-days';
import { subscriptionDueDatesInPeriod } from '@/features/plan/utils/recurring-due-in-period';
import { intervalLabel } from '@/features/transactions/utils/recurring-transaction-label';
import { SubscriptionAmountDisplay } from '@/features/deadlines/components/SubscriptionAmountDisplay';
import {
  formatSubscriptionNativeAmount,
  subscriptionAmountToToman,
} from '@/features/deadlines/utils/subscription-amount-display';
import {
  currentPeriod,
  formatPeriodLabel,
  shiftPeriod,
  type Period,
} from '@/shared/utils/period';
import { toPersianDigits } from '@/shared/utils/format-display-number';

type FilterKey = 'active' | 'cancelled' | 'all';

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: 'فعال',
  cancelled: 'لغو شده',
};

export function SubscriptionsHubView() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { wallets, categories, currencyRates, setTransactions } = useData();
  const { currencyMode, usdRate } = useUI();

  const [rows, setRows] = useState<Subscription[]>([]);
  const [filter, setFilter] = useState<FilterKey>('active');
  const [summaryPeriod, setSummaryPeriod] = useState<Period>(() => currentPeriod('month'));
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settlementTarget, setSettlementTarget] = useState<Subscription | null>(null);
  const [settlementWalletId, setSettlementWalletId] = useState<string | null>(null);
  const [isSettlementPickerOpen, setIsSettlementPickerOpen] = useState(false);

  const todayStr = useMemo(() => formatJalaali(todayJalaali()), []);

  const refresh = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .is('deleted_at', null)
        .order('next_due_date_string', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRows((data ?? []) as Subscription[]);
    } catch (error) {
      console.error(error);
      toast.error('خطا در دریافت اشتراک‌ها.');
    } finally {
      setIsLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredRows = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'cancelled') return rows.filter((row) => row.status === 'cancelled');
    return rows.filter((row) => row.status === 'active');
  }, [filter, rows]);

  const monthlySummary = useMemo(() => {
    const activeRows = rows.filter((row) => row.status === 'active');
    const lineItems = activeRows
      .map((row) => {
        const dueDates = subscriptionDueDatesInPeriod(row, summaryPeriod);
        if (dueDates.length === 0) return null;
        const unitToman = subscriptionAmountToToman(row.amount, row.currency, currencyRates);
        const totalToman = unitToman * dueDates.length;
        const displayTotal =
          currencyMode === 'USD' && usdRate > 0 ? totalToman / usdRate : totalToman;
        return {
          id: row.id,
          platform: row.platform,
          count: dueDates.length,
          displayTotal,
          currency: row.currency,
          nativeTotal: row.amount * dueDates.length,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null);

    const total = lineItems.reduce((sum, row) => sum + row.displayTotal, 0);
    return {
      label: formatPeriodLabel(summaryPeriod),
      total,
      lineItems,
    };
  }, [currencyMode, currencyRates, rows, summaryPeriod, usdRate]);

  const walletItems = useMemo(
    () =>
      wallets.map((wallet) => ({
        id: wallet.id,
        label: `${wallet.name} · ${wallet.currency}`,
      })),
    [wallets]
  );

  const selectedSettlementWallet = wallets.find((wallet) => wallet.id === settlementWalletId) ?? null;

  const openSettle = (row: Subscription) => {
    setSettlementTarget(row);
    setSettlementWalletId(row.wallet_id ?? wallets[0]?.id ?? null);
  };

  const closeSettle = () => {
    setSettlementTarget(null);
    setSettlementWalletId(null);
  };

  const handleSettle = async () => {
    if (!settlementTarget || !settlementWalletId) {
      toast.error('کیف پول پرداخت را انتخاب کن.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/subscriptions/settle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: settlementTarget.id,
          walletId: settlementWalletId,
        }),
      });
      const result = (await res.json()) as
        | { ok: true; transactionId: string; nextDueDateString: string }
        | { error?: string; code?: string };

      if (!res.ok || !('ok' in result) || !result.ok) {
        toast.error('error' in result && result.error ? result.error : 'خطا در تسویه اشتراک.');
        return;
      }

      const { data: txData } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', result.transactionId)
        .single();
      if (txData) {
        setTransactions((prev) => [txData as Transaction, ...prev]);
      }

      toast.success('اشتراک تسویه شد و تراکنش ثبت شد.');
      closeSettle();
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error('خطا در تسویه اشتراک.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async (row: Subscription) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .eq('status', 'active');
      if (error) throw error;
      toast.success('اشتراک لغو شد.');
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error('خطا در لغو اشتراک.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReactivate = async (row: Subscription) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          status: 'active',
          cancelled_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
        .eq('status', 'cancelled');
      if (error) throw error;
      toast.success('اشتراک دوباره فعال شد.');
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error('خطا در فعال‌سازی اشتراک.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (row: Subscription) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) throw error;
      toast.success('اشتراک حذف شد.');
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error('خطا در حذف اشتراک.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">اشتراک‌ها</h2>
        <button
          type="button"
          onClick={() => router.push('/deadlines/subscriptions/new')}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          اشتراک جدید
        </button>
      </div>

      <section className="bg-[#1A1B26] border border-white/5 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white">هزینه ماهانه</h3>
            <p className="text-[11px] text-slate-500">جمع اشتراک‌های فعال در ماه انتخاب‌شده</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSummaryPeriod((prev) => shiftPeriod(prev, -1))}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 inline-flex items-center justify-center"
              aria-label="previous-month"
            >
              <ChevronRight size={16} />
            </button>
            <span className="text-xs text-slate-300 min-w-[6rem] text-center">{monthlySummary.label}</span>
            <button
              type="button"
              onClick={() => setSummaryPeriod((prev) => shiftPeriod(prev, 1))}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 inline-flex items-center justify-center"
              aria-label="next-month"
            >
              <ChevronLeft size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5">
          <span className="text-xs text-slate-400">جمع</span>
          <span className="text-sm font-bold text-emerald-300" dir="ltr">
            {formatCurrency(monthlySummary.total, currencyMode)}
          </span>
        </div>

        {monthlySummary.lineItems.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-2">سررسیدی در این ماه نیست.</p>
        ) : (
          <div className="space-y-1.5">
            {monthlySummary.lineItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-2.5 py-1.5"
              >
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-200 truncate">{item.platform}</p>
                  <p className="text-[10px] text-slate-500">
                    {toPersianDigits(item.count)} بار
                  </p>
                </div>
                <span className="text-[11px] text-slate-300 shrink-0" dir="ltr">
                  <p>{formatCurrency(item.displayTotal, currencyMode)}</p>
                  {item.currency !== 'IRT' && (
                    <p className="text-[10px] text-slate-500">
                      {formatSubscriptionNativeAmount(item.nativeTotal, item.currency)}
                    </p>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-3 gap-1 bg-[#1A1B26] p-1 rounded-xl">
        {(
          [
            ['active', 'فعال'],
            ['cancelled', 'لغو شده'],
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
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={<Repeat size={24} />}
          title={filter === 'active' ? 'اشتراک فعالی ندارید.' : 'موردی برای نمایش نیست.'}
          description={
            filter === 'active'
              ? 'اشتراک‌های دوره‌ای را ثبت کنید تا سررسید را از دست ندهید.'
              : undefined
          }
          actionLabel={filter === 'active' ? 'ثبت اولین اشتراک' : undefined}
          onAction={filter === 'active' ? () => router.push('/deadlines/subscriptions/new') : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filteredRows.map((row) => {
            const category = row.category_id
              ? categories.find((c) => c.id === row.category_id)
              : null;
            const wallet = row.wallet_id ? wallets.find((w) => w.id === row.wallet_id) : null;
            const due = parseJalaali(row.next_due_date_string);
            const days = daysBetweenJalaali(todayStr, row.next_due_date_string);
            const isOverdue = row.status === 'active' && days != null && days < 0;
            const isToday = row.status === 'active' && days === 0;

            return (
              <div
                key={row.id}
                className="bg-[#1A1B26] border border-white/5 p-4 rounded-2xl space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-100 truncate">{row.platform}</h3>
                    <p className="text-xs text-slate-500 mt-1">
                      {[intervalLabel(row), category?.name, wallet?.name]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                  </div>
                  <span
                    className={`text-[11px] px-2 py-1 rounded-lg shrink-0 ${
                      row.status === 'active'
                        ? isOverdue
                          ? 'bg-rose-500/15 text-rose-300'
                          : isToday
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-slate-500/15 text-slate-400'
                    }`}
                  >
                    {STATUS_LABEL[row.status]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-white/3 rounded-xl p-2.5">
                    <p className="text-slate-500">مبلغ</p>
                    <div className="mt-1">
                      <SubscriptionAmountDisplay
                        amount={row.amount}
                        currency={row.currency}
                        currencyRates={currencyRates}
                        currencyMode={currencyMode}
                        usdRate={usdRate}
                        primaryClassName="text-slate-200 text-xs"
                      />
                    </div>
                  </div>
                  <div className="bg-white/3 rounded-xl p-2.5">
                    <p className="text-slate-500">سررسید بعدی</p>
                    <p className="text-slate-200 mt-1">
                      {due ? toPersianDigits(formatJalaaliHuman(due)) : row.next_due_date_string}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {row.status === 'active' && (
                    <>
                      <button
                        type="button"
                        onClick={() => openSettle(row)}
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white transition disabled:opacity-50"
                      >
                        <CreditCard size={13} />
                        پرداخت
                      </button>
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => void handleCancel(row)}
                        className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition disabled:opacity-50"
                      >
                        <XCircle size={13} />
                        لغو
                      </button>
                    </>
                  )}
                  {row.status === 'cancelled' && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleReactivate(row)}
                      className="inline-flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition disabled:opacity-50"
                    >
                      <RotateCcw size={13} />
                      فعال‌سازی
                    </button>
                  )}
                  <Link
                    href={`/deadlines/subscriptions/${row.id}/edit`}
                    className="text-[12px] px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition"
                  >
                    ویرایش
                  </Link>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleDelete(row)}
                    className="text-[12px] px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 transition disabled:opacity-50"
                  >
                    <span className="inline-flex items-center gap-1">
                      <Trash2 size={13} />
                      حذف
                    </span>
                  </button>
                </div>
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
              onClick={() => void handleSettle()}
              disabled={isSubmitting || !settlementWalletId}
              className="flex-1 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="inline-flex items-center gap-1">
                  <Loader2 size={14} className="animate-spin" />
                  در حال تسویه...
                </span>
              ) : selectedSettlementWallet ? (
                `ثبت پرداخت با ${selectedSettlementWallet.name}`
              ) : (
                'ثبت پرداخت'
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
