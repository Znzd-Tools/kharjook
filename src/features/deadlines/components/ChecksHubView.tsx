'use client';

import { useRateHistories, usdRateOn } from '@/features/rates/hooks/use-rate-histories';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ActionSheet,
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
import { FileText, MoreHorizontal, Plus } from '@/design-system/icons';
import { DeadlineAmount } from '@/features/deadlines/v2/DeadlineAmount';
import { useSafeBack } from '@/shared/hooks/use-safe-back';
import { useAuth, useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { fireExpenseAlert } from '@/features/notifications/client/fire-expense-alert';
import { supabase } from '@/shared/lib/supabase/client';
import type { Check, CheckStatus, Transaction } from '@/shared/types/domain';
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

function daysUntilDue(dueDateString: string, todayStr: string): number | null {
  return daysBetweenJalaali(todayStr, dueDateString);
}

export function ChecksHubView() {
  const router = useRouter();
  const confirm = useConfirm();
  const goBack = useSafeBack('/deadlines');
  const [menuFor, setMenuFor] = useState<Check | null>(null);
  const { user } = useAuth();
  const { wallets, categories, currencyRates, setTransactions } = useData();
  const { usdRate } = useUI();
  const rateHistories = useRateHistories();

  const [checks, setChecks] = useState<Check[]>([]);
  const [filter, setFilter] = useState<FilterKey>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settlementTarget, setSettlementTarget] = useState<Check | null>(null);
  const [settlementWalletId, setSettlementWalletId] = useState<string | null>(null);

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
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredChecks = useMemo(() => {
    if (filter === 'all') return checks;
    if (filter === 'cleared') {
      return checks.filter(
        (check) =>
          check.status === 'cleared' ||
          check.status === 'bounced' ||
          check.status === 'cancelled'
      );
    }
    return checks.filter((check) => check.status === 'pending');
  }, [checks, filter]);

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

    // USD snapshot at the rate of the row's date (due date), not today's.
    const snapUsdRate = usdRateOn(rateHistories, settlementTarget.due_date_string, todayStr, usdRate);
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
      usd_rate: wallet.currency === 'IRT' ? null : snapUsdRate,
      amount_toman_at_time: payAmount * payRate,
      amount_usd_at_time: (payAmount * payRate) / snapUsdRate,
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

      const { data: checkRows, error: checkErr } = await supabase
        .from('checks')
        .update({
          status: 'cleared',
          cleared_at: new Date().toISOString(),
          paid_transaction_id: createdTx.id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settlementTarget.id)
        .eq('status', 'pending')
        .select('id');
      if (checkErr || !checkRows || checkRows.length === 0) {
        // Roll back: the check was not marked, so the expense must not stay.
        await supabase.from('transactions').delete().eq('id', createdTx.id);
        if (checkErr) throw checkErr;
        toast.error('این چک قبلاً تسویه شده.');
        closeSettle();
        await refresh();
        return;
      }

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

  const handleMarkCancelled = async (check: Check) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('checks')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', check.id)
        .eq('status', 'pending');
      if (error) throw error;
      toast.success('چک عودت/لغو شد.');
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error('خطا در عودت چک.');
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

  const statusTone = (check: Check, days: number | null) =>
    check.status === 'pending'
      ? days != null && days < 0
        ? 'negative'
        : days === 0
          ? 'warning'
          : 'info'
      : check.status === 'cleared'
        ? 'positive'
        : check.status === 'bounced'
          ? 'negative'
          : 'neutral';

  return (
    <div className="min-h-full bg-canvas pb-10">
      <TopBar
        onBack={() => goBack()}
        title="چک‌ها"
        actions={
          <Button size="sm" startIcon={<Plus />} onClick={() => router.push('/deadlines/checks/new')}>
            چک جدید
          </Button>
        }
      />
      <div className="space-y-4 px-(--ds-gutter)">
        <SegmentedControl
          aria-label="وضعیت چک"
          value={filter}
          onValueChange={(v) => setFilter(v as FilterKey)}
          options={[
            { value: 'pending', label: 'در انتظار' },
            { value: 'cleared', label: 'بسته شده' },
            { value: 'all', label: 'همه' },
          ]}
        />

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-24 rounded-card" />
            <Skeleton className="h-24 rounded-card" />
          </div>
        ) : filteredChecks.length === 0 ? (
          <div className="rounded-card bg-panel">
            <EmptyState
              icon={<FileText />}
              title={filter === 'pending' ? 'چک در انتظاری نداری' : 'موردی برای نمایش نیست'}
              description={filter === 'pending' ? 'چک‌های صادره را با تاریخ سررسید ثبت کن تا سررسید را از دست ندهی.' : undefined}
              action={filter === 'pending' ? <Button onClick={() => router.push('/deadlines/checks/new')}>ثبت اولین چک</Button> : undefined}
            />
          </div>
        ) : (
          <ul className="space-y-2">
            {filteredChecks.map((check) => {
              const category = check.category_id ? categories.find((c) => c.id === check.category_id) : null;
              const due = parseJalaali(check.due_date_string);
              const days = daysUntilDue(check.due_date_string, todayStr);
              return (
                <li key={check.id} className="space-y-3 rounded-card bg-panel p-4" aria-label={`چک ${check.title}`}>
                  <div className="flex items-start gap-3">
                    <Avatar tone="peach" fallback={<FileText />} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <Text variant="callout" className="truncate font-semibold">
                          {check.title}
                        </Text>
                        <DeadlineAmount value={Number(check.amount)} currency={check.currency} />
                      </div>
                      <Text variant="caption" tone="subtle" className="truncate">
                        {[check.bank_name, check.check_number ? `#${check.check_number}` : null, category?.name].filter(Boolean).join(' · ') || '—'}
                      </Text>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge tone={statusTone(check, days)}>{STATUS_LABEL[check.status]}</Badge>
                        <Text variant="caption" tone="muted">
                          سررسید {due ? formatJalaaliHuman(due) : check.due_date_string}
                        </Text>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    {check.status === 'pending' && (
                      <Button size="sm" variant="soft" disabled={isSubmitting} onClick={() => openSettle(check)}>
                        تسویه
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" render={<Link href={`/deadlines/checks/${check.id}/edit`} />} nativeButton={false}>
                      ویرایش
                    </Button>
                    <IconButton size="sm" aria-label={`گزینه‌های ${check.title}`} icon={<MoreHorizontal />} onClick={() => setMenuFor(check)} />
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
        title={menuFor?.title}
        actions={
          menuFor
            ? [
                ...(menuFor.status === 'pending'
                  ? [
                      { key: 'bounce', label: 'برگشت خورد', onSelect: () => void handleMarkBounced(menuFor) },
                      { key: 'cancel', label: 'عودت / لغو', onSelect: () => void handleMarkCancelled(menuFor) },
                    ]
                  : []),
                {
                  key: 'delete',
                  label: 'حذف چک',
                  tone: 'danger' as const,
                  onSelect: async () => {
                    const target = menuFor;
                    const ok = await confirm({ title: `چک «${target.title}» حذف شود؟`, confirmLabel: 'حذف', tone: 'danger' });
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
        title={settlementTarget ? `تسویه چک «${settlementTarget.title}»` : ''}
        footer={
          <Button fullWidth size="lg" loading={isSubmitting} disabled={!settlementWalletId} onClick={() => void handleSettle()}>
            {selectedSettlementWallet ? `ثبت تسویه از ${selectedSettlementWallet.name}` : 'ثبت تسویه'}
          </Button>
        }
      >
        <div className="space-y-4">
          {settlementTarget && (
            <div className="flex items-center justify-between rounded-card bg-sunken p-3">
              <Text variant="caption" tone="subtle">
                مبلغ چک
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
