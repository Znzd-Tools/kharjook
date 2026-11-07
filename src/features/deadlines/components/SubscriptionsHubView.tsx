'use client';

import { BottomSheet } from '@/shared/components/BottomSheet';
import {
  ActionSheet,
  HeaderAction,
  IconBadge,
  ListGroup,
  ListRow,
  Money,
  PageHeader,
  PickerRow,
  PrimaryButton,
  SegmentedControl,
} from '@/shared/components/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Pencil,
  Loader2,
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
  const [actionRowId, setActionRowId] = useState<string | null>(null);
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

  const actionRow = filteredRows.find((r) => r.id === actionRowId) ?? null;
  const navBtn =
    'inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 hover:bg-white/6 hover:text-zinc-100';

  return (
    <div className="px-4 pb-8 space-y-6 animate-[fade-in_250ms_ease-out]">
      <PageHeader
        className="-mx-4"
        title="اشتراک‌ها"
        actions={<HeaderAction label="اشتراک جدید" href="/deadlines/subscriptions/new" />}
      />

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3 px-1">
          <div className="min-w-0">
            <p className="text-xs text-zinc-500">هزینه اشتراک‌ها در {monthlySummary.label}</p>
            <p className="mt-1 text-[1.75rem] leading-tight font-semibold tracking-tight text-zinc-50">
              <Money>{formatCurrency(monthlySummary.total, currencyMode)}</Money>
            </p>
          </div>
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={() => setSummaryPeriod((prev) => shiftPeriod(prev, -1))}
              className={navBtn}
              aria-label="ماه قبل"
            >
              <ChevronRight size={17} />
            </button>
            <button
              type="button"
              onClick={() => setSummaryPeriod((prev) => shiftPeriod(prev, 1))}
              className={navBtn}
              aria-label="ماه بعد"
            >
              <ChevronLeft size={17} />
            </button>
          </div>
        </div>
        {monthlySummary.lineItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {monthlySummary.lineItems.map((item) => (
              <span key={item.id} className="rounded-full bg-white/6 px-2.5 py-1 text-xs text-zinc-300">
                {item.platform}
                {item.count > 1 ? ` ×${toPersianDigits(item.count)}` : ''} ·{' '}
                <Money className="text-zinc-400">{formatCurrency(item.displayTotal, currencyMode)}</Money>
              </span>
            ))}
          </div>
        )}
      </section>

      <SegmentedControl
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'active', label: 'فعال' },
          { value: 'cancelled', label: 'لغوشده' },
          { value: 'all', label: 'همه' },
        ]}
      />

      {isLoading ? (
        <div className="py-10 text-center text-zinc-500 animate-pulse">در حال دریافت...</div>
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={<Repeat size={22} />}
          title={filter === 'active' ? 'اشتراک فعالی نداری.' : 'موردی برای نمایش نیست.'}
          description={
            filter === 'active' ? 'اشتراک‌های دوره‌ای را ثبت کن تا سررسید را از دست ندهی.' : undefined
          }
          actionLabel={filter === 'active' ? 'ثبت اولین اشتراک' : undefined}
          onAction={filter === 'active' ? () => router.push('/deadlines/subscriptions/new') : undefined}
        />
      ) : (
        <ListGroup>
          {filteredRows.map((row) => {
            const category = row.category_id ? categories.find((c) => c.id === row.category_id) : null;
            const wallet = row.wallet_id ? wallets.find((w) => w.id === row.wallet_id) : null;
            const due = parseJalaali(row.next_due_date_string);
            const days = daysBetweenJalaali(todayStr, row.next_due_date_string);
            const active = row.status === 'active';
            const hint = !active
              ? { text: STATUS_LABEL[row.status], tone: 'text-zinc-500' }
              : days == null
                ? { text: '', tone: '' }
                : days < 0
                  ? { text: `${toPersianDigits(-days)} روز گذشته`, tone: 'text-rose-400' }
                  : days === 0
                    ? { text: 'امروز', tone: 'text-amber-300' }
                    : { text: `${toPersianDigits(days)} روز دیگر`, tone: days <= 7 ? 'text-amber-200/80' : 'text-zinc-500' };
            return (
              <ListRow
                key={row.id}
                onClick={() => setActionRowId(row.id)}
                className={active ? '' : 'opacity-60'}
                leading={
                  <IconBadge color={active ? '#22d3ee' : undefined}>
                    <Repeat size={17} strokeWidth={1.9} />
                  </IconBadge>
                }
                title={row.platform}
                subtitle={[
                  due ? toPersianDigits(formatJalaaliHuman(due)) : row.next_due_date_string,
                  intervalLabel(row),
                  category?.name,
                  wallet?.name,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                trailing={
                  <SubscriptionAmountDisplay
                    amount={row.amount}
                    currency={row.currency}
                    currencyRates={currencyRates}
                    currencyMode={currencyMode}
                    usdRate={usdRate}
                    primaryClassName="text-sm font-semibold text-zinc-100"
                    secondaryClassName="text-[11px] text-zinc-500"
                    align="end"
                  />
                }
                trailingSub={<span className={hint.tone}>{hint.text}</span>}
              />
            );
          })}
        </ListGroup>
      )}

      <ActionSheet
        open={actionRow !== null}
        onClose={() => setActionRowId(null)}
        title={actionRow?.platform}
        actions={
          actionRow
            ? [
                ...(actionRow.status === 'active'
                  ? [
                      { label: 'ثبت پرداخت', icon: <CreditCard size={17} />, onSelect: () => openSettle(actionRow) },
                      {
                        label: 'لغو اشتراک',
                        icon: <XCircle size={17} />,
                        disabled: isSubmitting,
                        onSelect: () => void handleCancel(actionRow),
                      },
                    ]
                  : [
                      {
                        label: 'فعال‌سازی دوباره',
                        icon: <RotateCcw size={17} />,
                        disabled: isSubmitting,
                        onSelect: () => void handleReactivate(actionRow),
                      },
                    ]),
                {
                  label: 'ویرایش',
                  icon: <Pencil size={17} />,
                  onSelect: () => router.push(`/deadlines/subscriptions/${actionRow.id}/edit`),
                },
                {
                  label: 'حذف',
                  icon: <Trash2 size={17} />,
                  tone: 'danger' as const,
                  disabled: isSubmitting,
                  onSelect: () => void handleDelete(actionRow),
                },
              ]
            : []
        }
      />

      <BottomSheet open={settlementTarget !== null} onClose={closeSettle} title="ثبت پرداخت اشتراک">
        {settlementTarget && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white/4 p-4">
              <p className="text-sm text-zinc-300">{settlementTarget.platform}</p>
              <div className="mt-1">
                <SubscriptionAmountDisplay
                  amount={settlementTarget.amount}
                  currency={settlementTarget.currency}
                  currencyRates={currencyRates}
                  currencyMode={currencyMode}
                  usdRate={usdRate}
                  primaryClassName="text-2xl font-semibold tracking-tight text-zinc-50"
                  secondaryClassName="text-xs text-zinc-500"
                />
              </div>
            </div>
            <PickerRow
              label="پرداخت از"
              value={selectedSettlementWallet?.name}
              placeholder="انتخاب کیف پول"
              disabled={isSubmitting}
              onClick={() => setIsSettlementPickerOpen(true)}
            />
            <PrimaryButton onClick={() => void handleSettle()} disabled={isSubmitting || !settlementWalletId}>
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  در حال ثبت...
                </>
              ) : (
                'ثبت پرداخت'
              )}
            </PrimaryButton>
          </div>
        )}
      </BottomSheet>

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
    </div>
  );
}
