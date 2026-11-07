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
import { useRateHistories, usdRateOn } from '@/features/rates/hooks/use-rate-histories';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Ban,
  CreditCard,
  Loader2,
  Pencil,
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
import { toPersianDigits } from '@/shared/utils/format-display-number';

type FilterKey = 'pending' | 'cleared' | 'all';

const STATUS_COLOR: Record<CheckStatus, string> = {
  pending: '#a78bfa',
  cleared: '#34d399',
  bounced: '#fb7185',
  cancelled: '#71717a',
};

const STATUS_LABEL: Record<CheckStatus, string> = {
  pending: 'در انتظار',
  cleared: 'وصول شده',
  bounced: 'برگشتی',
  cancelled: 'لغو شده',
};

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
  const rateHistories = useRateHistories();

  const [checks, setChecks] = useState<Check[]>([]);
  const [filter, setFilter] = useState<FilterKey>('pending');
  const [actionCheckId, setActionCheckId] = useState<string | null>(null);
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
      return checks.filter(
        (check) =>
          check.status === 'cleared' ||
          check.status === 'bounced' ||
          check.status === 'cancelled'
      );
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

  const actionCheck = filteredChecks.find((c) => c.id === actionCheckId) ?? null;
  const pendingTotal = checks
    .filter((c) => c.status === 'pending')
    .reduce((sum, c) => sum + displayAmount(c), 0);

  const dueHint = (check: Check) => {
    if (check.status !== 'pending') return { text: STATUS_LABEL[check.status], tone: 'text-zinc-500' };
    const days = daysUntilDue(check.due_date_string, todayStr);
    if (days == null) return { text: '', tone: 'text-zinc-500' };
    if (days < 0) return { text: `${toPersianDigits(-days)} روز گذشته`, tone: 'text-rose-400' };
    if (days === 0) return { text: 'امروز', tone: 'text-amber-300' };
    return { text: `${toPersianDigits(days)} روز دیگر`, tone: days <= 7 ? 'text-amber-200/80' : 'text-zinc-500' };
  };

  return (
    <div className="px-4 pb-8 space-y-5 animate-[fade-in_250ms_ease-out]">
      <PageHeader
        className="-mx-4"
        title="چک‌ها"
        actions={<HeaderAction label="چک جدید" href="/deadlines/checks/new" />}
      />

      {pendingTotal > 0 && (
        <div className="px-1">
          <p className="text-xs text-zinc-500">جمع چک‌های در انتظار</p>
          <p className="mt-1 text-[1.75rem] leading-tight font-semibold tracking-tight text-zinc-50">
            <Money>{formatCurrency(pendingTotal, currencyMode)}</Money>
          </p>
        </div>
      )}

      <SegmentedControl
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'pending', label: 'در انتظار' },
          { value: 'cleared', label: 'بسته‌شده' },
          { value: 'all', label: 'همه' },
        ]}
      />

      {isLoading ? (
        <div className="py-10 text-center text-zinc-500 animate-pulse">در حال دریافت...</div>
      ) : filteredChecks.length === 0 ? (
        <EmptyState
          icon={<ReceiptText size={22} />}
          title={filter === 'pending' ? 'چک در انتظاری نداری.' : 'موردی برای نمایش نیست.'}
          description={
            filter === 'pending'
              ? 'چک‌های صادره را با تاریخ سررسید ثبت کن تا سررسید را از دست ندهی.'
              : undefined
          }
          actionLabel={filter === 'pending' ? 'ثبت اولین چک' : undefined}
          onAction={filter === 'pending' ? () => router.push('/deadlines/checks/new') : undefined}
        />
      ) : (
        <ListGroup>
          {filteredChecks.map((check) => {
            const category = check.category_id ? categories.find((c) => c.id === check.category_id) : null;
            const due = parseJalaali(check.due_date_string);
            const hint = dueHint(check);
            return (
              <ListRow
                key={check.id}
                onClick={check.status === 'pending' ? () => setActionCheckId(check.id) : undefined}
                className={check.status === 'pending' ? '' : 'opacity-60'}
                leading={
                  <IconBadge color={STATUS_COLOR[check.status]}>
                    <ReceiptText size={17} strokeWidth={1.9} />
                  </IconBadge>
                }
                title={check.title}
                subtitle={[
                  due ? toPersianDigits(formatJalaaliHuman(due)) : check.due_date_string,
                  check.bank_name,
                  check.check_number ? `#${check.check_number}` : null,
                  category?.name,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                trailing={<Money>{formatCurrency(displayAmount(check), currencyMode)}</Money>}
                trailingSub={<span className={hint.tone}>{hint.text}</span>}
              />
            );
          })}
        </ListGroup>
      )}

      <ActionSheet
        open={actionCheck !== null}
        onClose={() => setActionCheckId(null)}
        title={actionCheck?.title}
        actions={
          actionCheck
            ? [
                { label: 'تسویه', icon: <CreditCard size={17} />, onSelect: () => openSettle(actionCheck) },
                {
                  label: 'برگشت خورد',
                  icon: <XCircle size={17} />,
                  disabled: isSubmitting,
                  onSelect: () => void handleMarkBounced(actionCheck),
                },
                {
                  label: 'عودت داده شد',
                  icon: <Ban size={17} />,
                  disabled: isSubmitting,
                  onSelect: () => void handleMarkCancelled(actionCheck),
                },
                {
                  label: 'ویرایش',
                  icon: <Pencil size={17} />,
                  onSelect: () => router.push(`/deadlines/checks/${actionCheck.id}/edit`),
                },
                {
                  label: 'حذف',
                  icon: <Trash2 size={17} />,
                  tone: 'danger',
                  disabled: isSubmitting,
                  onSelect: () => void handleDelete(actionCheck),
                },
              ]
            : []
        }
      />

      <BottomSheet open={settlementTarget !== null} onClose={closeSettle} title="تسویه چک">
        {settlementTarget && (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white/4 p-4">
              <p className="text-sm text-zinc-300">{settlementTarget.title}</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-50">
                <Money>{formatCurrency(displayAmount(settlementTarget), currencyMode)}</Money>
              </p>
            </div>
            <PickerRow
              label="پرداخت از"
              value={selectedSettlementWallet?.name}
              placeholder="انتخاب کیف پول"
              disabled={isSubmitting}
              onClick={() => setIsSettlementPickerOpen(true)}
            />
            <PrimaryButton onClick={handleSettle} disabled={isSubmitting || !settlementWalletId}>
              {isSubmitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  در حال تسویه...
                </>
              ) : (
                'ثبت تسویه'
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
