'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ActionSheet,
  Amount,
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  PickerField,
  SegmentedControl,
  Sheet,
  Skeleton,
  Text,
  TopBar,
  toast,
  useConfirm,
} from '@/design-system';
import { ChevronLeft, ChevronRight, MoreHorizontal, Plus, Zap } from '@/design-system/icons';
import { DeadlineAmount } from '@/features/deadlines/v2/DeadlineAmount';
import { useSafeBack } from '@/shared/hooks/use-safe-back';
import { useAuth, useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { supabase } from '@/shared/lib/supabase/client';
import type { Subscription, SubscriptionStatus, Transaction } from '@/shared/types/domain';
import { formatJalaali, formatJalaaliHuman, parseJalaali, todayJalaali } from '@/shared/utils/jalali';
import { daysBetweenJalaali } from '@/features/notifications/utils/jalali-days';
import { subscriptionDueDatesInPeriod } from '@/features/plan/utils/recurring-due-in-period';
import { intervalLabel } from '@/features/transactions/utils/recurring-transaction-label';
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

type FilterKey = 'active' | 'cancelled' | 'all';

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  active: 'فعال',
  cancelled: 'لغو شده',
};

export function SubscriptionsHubView() {
  const router = useRouter();
  const confirm = useConfirm();
  const goBack = useSafeBack('/deadlines');
  const [menuFor, setMenuFor] = useState<Subscription | null>(null);
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
  }, [user]);

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

  const fa = (n: number) => n.toLocaleString('fa-IR');
  const money = currencyMode === 'USD' ? 'USD' : 'TOMAN';

  return (
    <div className="min-h-full bg-canvas pb-10">
      <TopBar
        onBack={() => goBack()}
        title="اشتراک‌ها"
        actions={
          <Button size="sm" startIcon={<Plus />} onClick={() => router.push('/deadlines/subscriptions/new')}>
            اشتراک جدید
          </Button>
        }
      />
      <div className="space-y-5 px-(--ds-gutter)">
        <section aria-label="هزینه ماهانه اشتراک‌ها" className="space-y-3 rounded-card bg-panel p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <Text variant="caption" tone="subtle">
                هزینه اشتراک‌ها در {monthlySummary.label}
              </Text>
              <Amount value={monthlySummary.total} currency={money} size="lg" compact />
            </div>
            <div className="flex items-center gap-1">
              <IconButton size="sm" aria-label="ماه قبل" icon={<ChevronRight />} onClick={() => setSummaryPeriod((prev) => shiftPeriod(prev, -1))} />
              <IconButton size="sm" aria-label="ماه بعد" icon={<ChevronLeft />} onClick={() => setSummaryPeriod((prev) => shiftPeriod(prev, 1))} />
            </div>
          </div>
          {monthlySummary.lineItems.length === 0 ? (
            <Text variant="caption" tone="subtle">
              سررسیدی در این ماه نیست.
            </Text>
          ) : (
            <ul className="space-y-1.5">
              {monthlySummary.lineItems.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 text-caption">
                  <span className="truncate text-fg-muted">
                    {item.platform} {item.count > 1 ? `· ${fa(item.count)} بار` : ''}
                  </span>
                  <span className="flex items-center gap-2">
                    {item.currency !== 'IRT' && <span className="text-fg-subtle" dir="ltr">{formatSubscriptionNativeAmount(item.nativeTotal, item.currency)}</span>}
                    {item.currency !== 'IRT' && !(item.displayTotal > 0) ? (
                      <Link href="/manage/rates" className="text-warning-ink underline">
                        نرخ ثبت نشده
                      </Link>
                    ) : (
                      <Amount value={item.displayTotal} currency={money} size="xs" compact />
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <SegmentedControl
          aria-label="وضعیت اشتراک"
          value={filter}
          onValueChange={(v) => setFilter(v as FilterKey)}
          options={[
            { value: 'active', label: 'فعال' },
            { value: 'cancelled', label: 'لغو شده' },
            { value: 'all', label: 'همه' },
          ]}
        />

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-24 rounded-card" />
            <Skeleton className="h-24 rounded-card" />
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-card bg-panel">
            <EmptyState
              icon={<Zap />}
              title={filter === 'active' ? 'اشتراک فعالی نداری' : 'موردی برای نمایش نیست'}
              description={filter === 'active' ? 'اشتراک‌های دوره‌ای را ثبت کن تا سررسید را از دست ندهی.' : undefined}
              action={filter === 'active' ? <Button onClick={() => router.push('/deadlines/subscriptions/new')}>ثبت اولین اشتراک</Button> : undefined}
            />
          </div>
        ) : (
          <ul className="space-y-2">
            {filteredRows.map((row) => {
              const category = row.category_id ? categories.find((c) => c.id === row.category_id) : null;
              const wallet = row.wallet_id ? wallets.find((w) => w.id === row.wallet_id) : null;
              const due = parseJalaali(row.next_due_date_string);
              const days = daysBetweenJalaali(todayStr, row.next_due_date_string);
              const tone =
                row.status !== 'active' ? 'neutral' : days != null && days < 0 ? 'negative' : days === 0 ? 'warning' : 'positive';
              return (
                <li key={row.id} className="space-y-3 rounded-card bg-panel p-4" aria-label={`اشتراک ${row.platform}`}>
                  <div className="flex items-start gap-3">
                    <Avatar tone="lemon" fallback={<Zap />} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Text variant="callout" className="truncate font-semibold">
                          {row.platform}
                        </Text>
                        <DeadlineAmount value={Number(row.amount)} currency={row.currency} />
                      </div>
                      <Text variant="caption" tone="subtle" className="truncate">
                        {[intervalLabel(row), category?.name, wallet?.name].filter(Boolean).join(' · ') || '—'}
                      </Text>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone={tone}>{STATUS_LABEL[row.status]}</Badge>
                        <Text variant="caption" tone="muted">
                          سررسید بعدی {due ? formatJalaaliHuman(due) : row.next_due_date_string}
                        </Text>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    {row.status === 'active' ? (
                      <Button size="sm" variant="soft" disabled={isSubmitting} onClick={() => openSettle(row)}>
                        پرداخت
                      </Button>
                    ) : (
                      <Button size="sm" variant="soft" disabled={isSubmitting} onClick={() => void handleReactivate(row)}>
                        فعال‌سازی دوباره
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" render={<Link href={`/deadlines/subscriptions/${row.id}/edit`} />} nativeButton={false}>
                      ویرایش
                    </Button>
                    <IconButton size="sm" aria-label={`گزینه‌های ${row.platform}`} icon={<MoreHorizontal />} onClick={() => setMenuFor(row)} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ActionSheet
        open={menuFor !== null}
        onOpenChange={(o) => !o && setMenuFor(null)}
        title={menuFor?.platform}
        actions={
          menuFor
            ? [
                ...(menuFor.status === 'active' ? [{ key: 'cancel', label: 'لغو اشتراک', onSelect: () => void handleCancel(menuFor) }] : []),
                {
                  key: 'delete',
                  label: 'حذف اشتراک',
                  tone: 'danger' as const,
                  onSelect: async () => {
                    const target = menuFor;
                    const ok = await confirm({ title: `اشتراک «${target.platform}» حذف شود؟`, confirmLabel: 'حذف', tone: 'danger' });
                    if (ok) void handleDelete(target);
                  },
                },
              ]
            : []
        }
      />

      <Sheet
        open={settlementTarget !== null}
        onOpenChange={(o) => !o && closeSettle()}
        title={settlementTarget ? `پرداخت «${settlementTarget.platform}»` : ''}
        footer={
          <Button fullWidth size="lg" loading={isSubmitting} disabled={!settlementWalletId} onClick={() => void handleSettle()}>
            {selectedSettlementWallet ? `ثبت پرداخت از ${selectedSettlementWallet.name}` : 'ثبت پرداخت'}
          </Button>
        }
      >
        <div className="space-y-4">
          {settlementTarget && (
            <div className="flex items-center justify-between rounded-card bg-sunken p-3">
              <Text variant="caption" tone="subtle">
                مبلغ
              </Text>
              <DeadlineAmount value={Number(settlementTarget.amount)} currency={settlementTarget.currency} />
            </div>
          )}
          <Field label="پرداخت از">
            <PickerField
              title="کیف پول پرداخت"
              options={walletItems.map((w) => ({ value: w.id, label: w.label }))}
              value={settlementWalletId}
              onValueChange={setSettlementWalletId}
            />
          </Field>
        </div>
      </Sheet>
    </div>
  );
}
