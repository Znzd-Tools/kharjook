'use client';

import { useRateHistories, usdRateOn } from '@/features/rates/hooks/use-rate-histories';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ActionSheet,
  AmountField,
  Avatar,
  Badge,
  Button,
  Chip,
  ChipGroup,
  EmptyState,
  Field,
  IconButton,
  PickerField,
  ProgressBar,
  SegmentedControl,
  Sheet,
  Skeleton,
  Text,
  TopBar,
  useConfirm,
} from '@/design-system';
import { CheckCircle2, ChevronLeft, ChevronRight, Landmark, MoreHorizontal, Plus } from '@/design-system/icons';
import { useSafeBack } from '@/shared/hooks/use-safe-back';
import { useAuth, useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { fireExpenseAlert } from '@/features/notifications/client/fire-expense-alert';
import { useToast } from '@/shared/components/Toast';
import { supabase } from '@/shared/lib/supabase/client';
import type { Loan, LoanInstallment, Transaction } from '@/shared/types/domain';
import { formatCurrency } from '@/shared/utils/format-currency';
import {
  formatJalaali,
  formatJalaaliHuman,
  jalaaliMonthLength,
  jalaaliWeekday,
  JALALI_MONTHS,
  parseJalaali,
  todayJalaali,
} from '@/shared/utils/jalali';
import { CURRENCY_META } from '@/features/wallets/constants/currency-meta';
import {
  canonicalInstallmentAmount,
  installmentHasPartialPay,
  installmentPaidAmount,
  installmentRemainingAmount,
  parsePartialPayAmount,
  validatePartialPayAmount,
} from '@/features/deadlines/utils/installment-remaining';
import { isAssetLoan, loanAmountToToman } from '@/features/deadlines/utils/loan-amount';
import { assetDecimals, formatAssetAmount } from '@/shared/utils/format-asset-amount';
import { toPersianDigits } from '@/shared/utils/format-display-number';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';

type TabKey = 'loans' | 'installments' | 'calendar';
type InstallmentFilter = 'all' | 'paid' | 'remaining';
type InstallmentRow = { installment: LoanInstallment; loan: Loan };

const WEEKDAY_LABELS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const;

export function LoansHubView() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { wallets, assets, categories, currencyRates, setTransactions } = useData();
  const { currencyMode, usdRate } = useUI();
  const rateHistories = useRateHistories();
  const assetsById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const [tab, setTab] = useState<TabKey>('loans');
  const [loans, setLoans] = useState<Loan[]>([]);
  const [installments, setInstallments] = useState<LoanInstallment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settlementTarget, setSettlementTarget] = useState<LoanInstallment | null>(null);
  const [settlementWalletId, setSettlementWalletId] = useState<string | null>(null);
  const [settlementPayAmount, setSettlementPayAmount] = useState('');
  const [menuFor, setMenuFor] = useState<Loan | null>(null);
  const confirm = useConfirm();
  const goBack = useSafeBack('/deadlines?v=loans');
  const [installmentFilter, setInstallmentFilter] = useState<InstallmentFilter>('remaining');
  const today = useMemo(() => todayJalaali(), []);
  const todayStr = useMemo(() => formatJalaali(today), [today]);
  const [calendarMonth, setCalendarMonth] = useState<{ jy: number; jm: number }>({
    jy: today.jy,
    jm: today.jm,
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(todayStr);

  const refresh = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [loanRes, installmentRes] = await Promise.all([
        supabase
          .from('loans')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('loan_installments')
          .select('*')
          .order('due_date_string', { ascending: true })
          .order('sequence_no', { ascending: true }),
      ]);
      if (loanRes.error) throw loanRes.error;
      if (installmentRes.error) throw installmentRes.error;
      setLoans((loanRes.data ?? []) as Loan[]);
      setInstallments((installmentRes.data ?? []) as LoanInstallment[]);
    } catch (error) {
      console.error(error);
      toast.error('خطا در دریافت اطلاعات اقساط و وام‌ها.');
    } finally {
      setIsLoading(false);
    }
  }, [toast, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loansById = useMemo(() => {
    return new Map(loans.map((loan) => [loan.id, loan]));
  }, [loans]);

  const installmentMetaByLoan = useMemo(() => {
    const meta = new Map<string, { total: number; lastSeq: number }>();
    for (const it of installments) {
      const prev = meta.get(it.loan_id);
      if (!prev) {
        meta.set(it.loan_id, { total: 1, lastSeq: it.sequence_no });
      } else {
        prev.total += 1;
        if (it.sequence_no > prev.lastSeq) prev.lastSeq = it.sequence_no;
      }
    }
    return meta;
  }, [installments]);

  const loansRows = useMemo(() => {
    return loans.map((loan) => {
      const all = installments.filter((it) => it.loan_id === loan.id);
      const paidCount = all.filter((it) => it.is_paid).length;
      return { loan, paidCount, totalCount: all.length };
    });
  }, [installments, loans]);
  const filteredLoanRows = loansRows;

  const installmentRows = useMemo<InstallmentRow[]>(() => {
    return installments
      .map((it) => ({ installment: it, loan: loansById.get(it.loan_id) ?? null }))
      .filter(
        (row): row is { installment: LoanInstallment; loan: Loan } => row.loan !== null
      );
  }, [installments, loansById]);

  const displayAmount = useCallback(
    (row: InstallmentRow) => {
      const principal = row.installment.is_paid
        ? row.installment.amount
        : installmentRemainingAmount(row.installment);
      const toman = loanAmountToToman(principal, row.loan, currencyRates, assetsById);
      if (!(toman > 0)) return principal;
      if (currencyMode === 'USD' && usdRate > 0) {
        return toman / usdRate;
      }
      return toman;
    },
    [assetsById, currencyMode, currencyRates, usdRate]
  );

  const formatLoanQty = useCallback(
    (amount: number, loan: Loan) => {
      if (!isAssetLoan(loan)) {
        const toman = loanAmountToToman(amount, loan, currencyRates, assetsById);
        const display =
          currencyMode === 'USD' && usdRate > 0 ? toman / usdRate : toman;
        return formatCurrency(display, currencyMode);
      }
      const asset = assetsById.get(loan.asset_id!);
      const unit = asset?.unit ?? '';
      return `${formatAssetAmount(amount, assetDecimals(asset))} ${unit}`.trim();
    },
    [assetsById, currencyMode, currencyRates, usdRate]
  );

  const filteredInstallmentRows = useMemo(() => {
    if (installmentFilter === 'all') return installmentRows;
    if (installmentFilter === 'paid') {
      return installmentRows.filter((row) => row.installment.is_paid);
    }
    return installmentRows.filter((row) => !row.installment.is_paid);
  }, [installmentFilter, installmentRows]);

  const groupedInstallments = useMemo(() => {
    const groups = new Map<string, {
      key: string;
      label: string;
      rows: Array<{ installment: LoanInstallment; loan: Loan }>;
      total: number;
    }>();
    for (const row of filteredInstallmentRows) {
      const parsed = parseJalaali(row.installment.due_date_string);
      const key = parsed
        ? `${parsed.jy}/${String(parsed.jm).padStart(2, '0')}`
        : row.installment.due_date_string.slice(0, 7);
      const label = parsed
        ? `${JALALI_MONTHS[parsed.jm - 1]} ${String(parsed.jy).replace(/\d/g, (c) => '۰۱۲۳۴۵۶۷۸۹'[Number(c)]!)}`
        : key;
      const existing = groups.get(key);
      if (existing) {
        existing.rows.push(row);
        existing.total += displayAmount(row);
      } else {
        groups.set(key, { key, label, rows: [row], total: displayAmount(row) });
      }
    }
    return Array.from(groups.values());
  }, [displayAmount, filteredInstallmentRows]);

  const monthKey = `${calendarMonth.jy}/${String(calendarMonth.jm).padStart(2, '0')}`;
  const monthLength = useMemo(
    () => jalaaliMonthLength(calendarMonth.jy, calendarMonth.jm),
    [calendarMonth.jm, calendarMonth.jy]
  );
  const firstWeekday = useMemo(
    () => jalaaliWeekday({ jy: calendarMonth.jy, jm: calendarMonth.jm, jd: 1 }),
    [calendarMonth.jm, calendarMonth.jy]
  );
  const monthInstallments = useMemo(
    () =>
      installmentRows.filter(
        (row) =>
          !row.installment.is_paid &&
          row.installment.due_date_string.startsWith(`${monthKey}/`)
      ),
    [installmentRows, monthKey]
  );
  const installmentsByDate = useMemo(() => {
    const map = new Map<string, InstallmentRow[]>();
    for (const row of monthInstallments) {
      const key = row.installment.due_date_string;
      const bucket = map.get(key) ?? [];
      bucket.push(row);
      map.set(key, bucket);
    }
    return map;
  }, [monthInstallments]);
  const selectedDayRows = useMemo(
    () => installmentsByDate.get(selectedCalendarDate) ?? [],
    [installmentsByDate, selectedCalendarDate]
  );
  const selectedDayLabel = useMemo(() => {
    const parsed = parseJalaali(selectedCalendarDate);
    return parsed ? formatJalaaliHuman(parsed) : selectedCalendarDate;
  }, [selectedCalendarDate]);
  const monthRemainingTotal = useMemo(() => {
    return monthInstallments.reduce((sum, row) => sum + displayAmount(row), 0);
  }, [displayAmount, monthInstallments]);
  const selectedRemainingTotal = useMemo(() => {
    return selectedDayRows.reduce((sum, row) => sum + displayAmount(row), 0);
  }, [displayAmount, selectedDayRows]);
  const calendarCells = useMemo(() => {
    const out: Array<{ date: string; day: number; rows: InstallmentRow[] } | null> = [];
    for (let i = 0; i < firstWeekday; i += 1) out.push(null);
    for (let day = 1; day <= monthLength; day += 1) {
      const date = `${monthKey}/${String(day).padStart(2, '0')}`;
      out.push({ date, day, rows: installmentsByDate.get(date) ?? [] });
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [firstWeekday, installmentsByDate, monthKey, monthLength]);

  useEffect(() => {
    const parsed = parseJalaali(selectedCalendarDate);
    if (parsed && parsed.jy === calendarMonth.jy && parsed.jm === calendarMonth.jm) return;
    setSelectedCalendarDate(`${monthKey}/01`);
  }, [calendarMonth.jm, calendarMonth.jy, monthKey, selectedCalendarDate]);

  const moveCalendarMonth = (delta: 1 | -1) => {
    setCalendarMonth((prev) => {
      if (delta === 1) {
        return prev.jm === 12 ? { jy: prev.jy + 1, jm: 1 } : { jy: prev.jy, jm: prev.jm + 1 };
      }
      return prev.jm === 1 ? { jy: prev.jy - 1, jm: 12 } : { jy: prev.jy, jm: prev.jm - 1 };
    });
  };

  const remainingTotalDisplay = useMemo(() => {
    const remainingRows = installmentRows.filter((row) => !row.installment.is_paid);
    let totalToman = 0;
    for (const row of remainingRows) {
      totalToman += loanAmountToToman(
        installmentRemainingAmount(row.installment),
        row.loan,
        currencyRates,
        assetsById
      );
    }
    if (currencyMode === 'USD') {
      return usdRate > 0 ? totalToman / usdRate : 0;
    }
    return totalToman;
  }, [assetsById, installmentRows, currencyMode, currencyRates, usdRate]);

  const walletItems = useMemo(() => {
    return wallets.map((wallet) => ({
      id: wallet.id,
      label: wallet.name,
      sublabel: `${CURRENCY_META[wallet.currency].label} · ${wallet.currency}`,
    }));
  }, [wallets]);
  const selectedSettlementWallet = useMemo(
    () => wallets.find((wallet) => wallet.id === settlementWalletId) ?? null,
    [settlementWalletId, wallets]
  );

  const openSettle = (installment: LoanInstallment) => {
    setSettlementTarget(installment);
    setSettlementWalletId(null);
    setSettlementPayAmount(canonicalInstallmentAmount(installmentRemainingAmount(installment)));
  };

  const closeSettle = () => {
    setSettlementTarget(null);
    setSettlementWalletId(null);
    setSettlementPayAmount('');
  };

  const handleDeleteLoan = async (loan: Loan) => {
    setIsSubmitting(true);
    try {
      const { error: updErr } = await supabase
        .from('loans')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', loan.id);
      if (updErr) throw updErr;

      const { error: delErr } = await supabase
        .from('loan_installments')
        .delete()
        .eq('loan_id', loan.id)
        .eq('is_paid', false);
      if (delErr) throw delErr;

      toast.success('وام حذف شد و اقساط باقی‌مانده پاک شدند.');
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error('خطا در حذف وام.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSettle = async () => {
    const loan = settlementTarget
      ? loansById.get(settlementTarget.loan_id) ?? null
      : null;
    if (!settlementTarget || !loan) {
      toast.error('اطلاعات پرداخت نامعتبر است.');
      return;
    }

    const assetLoan = isAssetLoan(loan);
    const asset = assetLoan ? assetsById.get(loan.asset_id!) ?? null : null;
    const wallet = assetLoan
      ? null
      : wallets.find((w) => w.id === settlementWalletId) ?? null;

    if (!assetLoan && !wallet) {
      toast.error('کیف پول پرداخت را انتخاب کن.');
      return;
    }
    if (assetLoan && !asset) {
      toast.error('دارایی وام پیدا نشد.');
      return;
    }

    const remaining = installmentRemainingAmount(settlementTarget);
    const payInLoanCurrency = parsePartialPayAmount(settlementPayAmount);
    if (!payInLoanCurrency) {
      toast.error(assetLoan ? 'مقدار پرداخت نامعتبر است.' : 'مبلغ پرداخت نامعتبر است.');
      return;
    }
    const amountError = validatePartialPayAmount(payInLoanCurrency, remaining);
    if (amountError) {
      toast.error(amountError);
      return;
    }

    let txPayload: Record<string, unknown>;

    // USD snapshot at the rate of the row's date (due date), not today's.
    const snapUsdRate = usdRateOn(rateHistories, settlementTarget.due_date_string, todayStr, usdRate);

    if (assetLoan && asset) {
      const priceToman = Number(asset.price_toman);
      if (!(priceToman > 0) || !(usdRate > 0)) {
        toast.error('قیمت دارایی برای تسویه در دسترس نیست.');
        return;
      }
      txPayload = {
        user_id: user?.id,
        type: 'EXPENSE',
        date_string: settlementTarget.due_date_string,
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
    } else if (wallet) {
      const loanRate = tomanPerUnit(loan.currency, currencyRates);
      const payRate = tomanPerUnit(wallet.currency, currencyRates);
      if (loanRate <= 0 || payRate <= 0 || usdRate <= 0) {
        toast.error('نرخ تبدیل برای تسویه در دسترس نیست.');
        return;
      }

      const payAmount = (payInLoanCurrency * loanRate) / payRate;
      if (!Number.isFinite(payAmount) || payAmount <= 0) {
        toast.error('مبلغ تسویه نامعتبر است.');
        return;
      }

      txPayload = {
        user_id: user?.id,
        type: 'EXPENSE',
        date_string: settlementTarget.due_date_string,
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
    } else {
      toast.error('اطلاعات پرداخت نامعتبر است.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: txData, error: txErr } = await supabase
        .from('transactions')
        .insert(txPayload)
        .select()
        .single();
      if (txErr) throw txErr;
      const createdTx = txData as Transaction;

      const newPaidAmount = installmentPaidAmount(settlementTarget) + payInLoanCurrency;
      const fullyPaid = newPaidAmount >= Number(settlementTarget.amount) - 1e-9;

      // Optimistic lock + rollback: never keep the expense when the
      // installment row was not updated (double tap / changed elsewhere).
      const { data: updatedRows, error: installmentErr } = await supabase
        .from('loan_installments')
        .update({
          paid_amount: newPaidAmount,
          is_paid: fullyPaid,
          paid_at: fullyPaid ? new Date().toISOString() : settlementTarget.paid_at,
          paid_transaction_id: createdTx.id,
        })
        .eq('id', settlementTarget.id)
        .eq('is_paid', false)
        .eq('paid_amount', installmentPaidAmount(settlementTarget))
        .select('id');
      if (installmentErr || !updatedRows || updatedRows.length === 0) {
        await supabase.from('transactions').delete().eq('id', createdTx.id);
        if (installmentErr) throw installmentErr;
        toast.error('این قسط هم‌زمان تغییر کرد. صفحه را تازه کن و دوباره تلاش کن.');
        await refresh();
        return;
      }

      setTransactions((prev) => [createdTx, ...prev]);
      fireExpenseAlert([createdTx.id]);
      toast.success(fullyPaid ? 'قسط تسویه شد و تراکنش ثبت شد.' : 'پرداخت جزئی ثبت شد.');
      closeSettle();
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error('خطا در تسویه قسط.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fa = (v: number | string) => toPersianDigits(String(v));
  const filterChips = <T extends string>(label: string, value: T, set: (v: T) => void, opts: [T, string][]) => (
    <ChipGroup aria-label={label} value={[value]} onValueChange={(v) => v[0] && set(v[0] as T)}>
      {opts.map(([k, l]) => (
        <Chip key={k} value={k}>
          {l}
        </Chip>
      ))}
    </ChipGroup>
  );
  const installmentLine = (installment: LoanInstallment, loan: Loan) => {
    const meta = installmentMetaByLoan.get(loan.id);
    const total = meta?.total ?? installment.sequence_no;
    const isLast = installment.sequence_no === (meta?.lastSeq ?? installment.sequence_no);
    const parsed = parseJalaali(installment.due_date_string);
    return (
      <li key={installment.id} className="flex items-center gap-3 rounded-card bg-panel p-3.5">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <Text variant="callout" className="truncate font-semibold">
              {loan.title}
            </Text>
            <span className="shrink-0 text-caption text-fg-subtle" dir="ltr">
              {fa(`${installment.sequence_no}/${total}`)}
            </span>
            {isLast && <Badge tone="warning">آخرین قسط</Badge>}
          </div>
          <Text variant="caption" tone="subtle">
            {parsed ? formatJalaaliHuman(parsed) : installment.due_date_string}
            {installmentHasPartialPay(installment) ? ' · پرداخت جزئی' : ''}
          </Text>
          <p className="tabular text-caption text-fg" dir="ltr">
            {isAssetLoan(loan)
              ? formatLoanQty(installment.is_paid ? installment.amount : installmentRemainingAmount(installment), loan)
              : formatCurrency(displayAmount({ installment, loan }), currencyMode)}
          </p>
        </div>
        {installment.is_paid ? (
          <Badge tone="positive">
            <CheckCircle2 className="size-3.5" aria-hidden /> تسویه‌شده
          </Badge>
        ) : (
          <Button size="sm" variant="soft" onClick={() => openSettle(installment)}>
            تسویه
          </Button>
        )}
      </li>
    );
  };

  return (
    <div className="min-h-full bg-canvas pb-10">
      <TopBar
        onBack={() => goBack()}
        title="اقساط و وام‌ها"
        actions={
          <Button size="sm" startIcon={<Plus />} onClick={() => router.push('/deadlines/loans/new')}>
            وام جدید
          </Button>
        }
      />
      <div className="space-y-4 px-(--ds-gutter)">
        <SegmentedControl
          aria-label="نمای وام‌ها"
          value={tab}
          onValueChange={(v) => setTab(v as TabKey)}
          options={[
            { value: 'loans', label: 'وام‌ها' },
            { value: 'installments', label: 'اقساط' },
            { value: 'calendar', label: 'تقویم بدهی' },
          ]}
        />

        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-28 rounded-card" />
            <Skeleton className="h-28 rounded-card" />
          </div>
        ) : tab === 'loans' ? (
          loansRows.length === 0 ? (
            <div className="rounded-card bg-panel">
              <EmptyState icon={<Landmark />} title="هنوز وامی ثبت نشده" action={<Button onClick={() => router.push('/deadlines/loans/new')}>ساخت اولین وام</Button>} />
            </div>
          ) : (
            <>
              {([
                ['وام‌های فعال', filteredLoanRows.filter((r) => !(r.totalCount > 0 && r.paidCount >= r.totalCount))],
                ['تمام‌شده', filteredLoanRows.filter((r) => r.totalCount > 0 && r.paidCount >= r.totalCount)],
              ] as const).map(([title, rows], gi) =>
                rows.length === 0 ? (
                  gi === 0 ? (
                    <Text key={title} variant="caption" tone="subtle" className="block py-4 text-center">
                      همه وام‌ها تسویه شده‌اند.
                    </Text>
                  ) : null
                ) : (
                  <section key={title} aria-label={title} className="space-y-2">
                    <Text variant="caption" tone="muted" className="px-1 font-semibold">
                      {title} ({rows.length.toLocaleString('fa-IR')})
                    </Text>
                    <ul className="space-y-2">
                      {rows.map(({ loan, paidCount, totalCount }) => {
                    const category = loan.category_id ? categories.find((c) => c.id === loan.category_id) : null;
                    const loanAsset = isAssetLoan(loan) ? assetsById.get(loan.asset_id!) ?? null : null;
                    const totalDisplay = loan.total_amount ?? loan.installment_amount * loan.repeat_count;
                    return (
                      <li key={loan.id} className="space-y-3 rounded-card bg-panel p-4" aria-label={`وام ${loan.title}`}>
                        <div className="flex items-start gap-3">
                          <Avatar tone="sky" fallback={<Landmark />} />
                          <div className="min-w-0 flex-1">
                            <Text variant="callout" className="truncate font-semibold">
                              {loan.title}
                            </Text>
                            <Text variant="caption" tone="subtle">
                              {loan.type === 'expense' ? 'خرید اعتباری' : 'وام نقدی'}
                              {loanAsset ? ` · ${loanAsset.name}` : category ? ` · ${category.name}` : ''}
                            </Text>
                          </div>
                          <IconButton size="sm" aria-label={`گزینه‌های ${loan.title}`} icon={<MoreHorizontal />} onClick={() => setMenuFor(loan)} />
                        </div>
                        <ProgressBar
                          tone="positive"
                          value={paidCount}
                          max={Math.max(totalCount, 1)}
                          label="پیشرفت تسویه"
                          valueLabel={`${fa(paidCount)} از ${fa(totalCount)} قسط`}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-control bg-sunken p-2.5">
                            <Text variant="caption" tone="subtle">
                              {isAssetLoan(loan) ? 'مقدار هر قسط' : 'هر قسط'}
                            </Text>
                            <p className="tabular text-callout text-fg" dir="ltr">
                              {formatLoanQty(loan.installment_amount, loan)}
                            </p>
                          </div>
                          <div className="rounded-control bg-sunken p-2.5">
                            <Text variant="caption" tone="subtle">
                              جمع کل
                            </Text>
                            <p className="tabular text-callout text-fg" dir="ltr">
                              {formatLoanQty(totalDisplay, loan)}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                    </ul>
                  </section>
                )
              )}
            </>
          )
        ) : tab === 'installments' ? (
          installmentRows.length === 0 ? (
            <div className="rounded-card bg-panel">
              <EmptyState title="قسطی برای نمایش نیست" description="بعد از ثبت وام، برنامه اقساط اینجا می‌آید." />
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-card bg-panel p-4">
                <Text variant="caption" tone="subtle">
                  جمع باقی‌مانده
                </Text>
                <span className="tabular text-headline text-fg" dir="ltr">
                  {formatCurrency(remainingTotalDisplay, currencyMode)}
                </span>
              </div>
              {filterChips('وضعیت قسط', installmentFilter, setInstallmentFilter, [
                ['remaining', 'باقی‌مانده'],
                ['paid', 'تسویه شده'],
                ['all', 'همه'],
              ])}
              {groupedInstallments.length === 0 ? (
                <Text variant="caption" tone="subtle" className="block py-6 text-center">
                  موردی با این فیلتر نیست.
                </Text>
              ) : (
                groupedInstallments.map((group) => (
                  <section key={group.key} aria-label={group.label} className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <Text variant="caption" tone="muted" className="font-semibold">
                        {group.label}
                      </Text>
                      <span className="tabular text-caption text-fg-muted" dir="ltr">
                        {formatCurrency(group.total, currencyMode)}
                      </span>
                    </div>
                    <ul className="space-y-2">{group.rows.map(({ installment, loan }) => installmentLine(installment, loan))}</ul>
                  </section>
                ))
              )}
            </>
          )
        ) : (
          <>
            <section aria-label="تقویم بدهی" className="space-y-3 rounded-card bg-panel p-3">
              <div className="flex items-center justify-between">
                <IconButton aria-label="ماه قبل" icon={<ChevronRight />} onClick={() => moveCalendarMonth(-1)} />
                <div className="text-center">
                  <Text variant="callout" className="font-semibold">
                    {JALALI_MONTHS[calendarMonth.jm - 1]} {fa(calendarMonth.jy)}
                  </Text>
                  <Text variant="caption" tone="subtle" className="block">
                    جمع بدهی ماه: {formatCurrency(monthRemainingTotal, currencyMode)}
                  </Text>
                </div>
                <IconButton aria-label="ماه بعد" icon={<ChevronLeft />} onClick={() => moveCalendarMonth(1)} />
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="py-1 text-micro text-fg-subtle">
                    {label}
                  </div>
                ))}
                {calendarCells.map((cell, idx) => {
                  if (!cell) return <div key={`empty-${idx}`} className="h-11" />;
                  const isSelected = selectedCalendarDate === cell.date;
                  const isToday = cell.date === todayStr;
                  const has = cell.rows.length > 0;
                  const overdue = has && cell.date < todayStr;
                  return (
                    <button
                      type="button"
                      key={cell.date}
                      aria-pressed={isSelected}
                      aria-label={`${fa(cell.day)}${has ? ` · ${fa(cell.rows.length)} قسط` : ''}`}
                      onClick={() => setSelectedCalendarDate(cell.date)}
                      className={`ds-focus relative h-11 rounded-control text-caption transition-colors ${
                        isSelected ? 'bg-accent text-fg-on-accent font-bold' : has ? 'bg-warning-soft text-fg' : 'bg-sunken text-fg-muted hover:bg-hover'
                      }`}
                    >
                      {fa(cell.day)}
                      {has && (
                        <span className={`absolute bottom-0.5 left-1/2 size-1.5 -translate-x-1/2 rounded-full ${overdue ? 'bg-negative' : 'bg-warning'}`} aria-hidden />
                      )}
                      {isToday && !isSelected && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-accent" aria-hidden />}
                    </button>
                  );
                })}
              </div>
            </section>
            <section aria-label={selectedDayLabel} className="space-y-2">
              <div className="flex items-center justify-between px-1">
                <Text variant="callout" className="font-semibold">
                  {selectedDayLabel}
                </Text>
                <span className="tabular text-caption text-fg-muted" dir="ltr">
                  {formatCurrency(selectedRemainingTotal, currencyMode)}
                </span>
              </div>
              {selectedDayRows.length === 0 ? (
                <Text variant="caption" tone="subtle" className="block py-3 text-center">
                  برای این روز قسطی نیست.
                </Text>
              ) : (
                <ul className="space-y-2">{selectedDayRows.map((row) => installmentLine(row.installment, row.loan))}</ul>
              )}
            </section>
          </>
        )}
      </div>

      <ActionSheet
        open={menuFor !== null}
        onOpenChange={(o) => !o && setMenuFor(null)}
        title={menuFor?.title}
        actions={
          menuFor
            ? [
                { key: 'edit', label: 'ویرایش وام', onSelect: () => router.push(`/deadlines/loans/${menuFor.id}/edit`) },
                {
                  key: 'delete',
                  label: 'حذف وام',
                  tone: 'danger' as const,
                  onSelect: async () => {
                    const target = menuFor;
                    const ok = await confirm({ title: `وام «${target.title}» حذف شود؟`, description: 'اقساط این وام هم حذف می‌شوند.', confirmLabel: 'حذف', tone: 'danger' });
                    if (ok) void handleDeleteLoan(target);
                  },
                },
              ]
            : []
        }
      />

      {(() => {
        const settleLoan = settlementTarget ? loansById.get(settlementTarget.loan_id) : undefined;
        const assetSettle = settleLoan ? isAssetLoan(settleLoan) : false;
        const settleAsset = assetSettle && settleLoan?.asset_id ? assetsById.get(settleLoan.asset_id) ?? null : null;
        const unitLabel = assetSettle ? settleAsset?.unit ?? 'واحد' : settleLoan ? CURRENCY_META[settleLoan.currency].label : '';
        const remaining = settlementTarget ? installmentRemainingAmount(settlementTarget) : 0;
        const canSubmit = assetSettle ? !!settlementPayAmount.trim() : !!settlementWalletId && !!settlementPayAmount.trim();
        return (
          <Sheet
            open={settlementTarget !== null}
            onOpenChange={(o) => !o && closeSettle()}
            title={settleLoan ? `تسویه قسط «${settleLoan.title}»` : 'تسویه قسط'}
            footer={
              <Button fullWidth size="lg" loading={isSubmitting} disabled={!canSubmit} onClick={() => void handleSettle()}>
                {assetSettle
                  ? settleAsset
                    ? `ثبت با ${settleAsset.name}`
                    : 'ثبت پرداخت'
                  : selectedSettlementWallet
                    ? `ثبت پرداخت از ${selectedSettlementWallet.name}`
                    : 'ثبت پرداخت'}
              </Button>
            }
          >
            <div className="space-y-4">
              <Field
                label={assetSettle ? `مقدار پرداخت (${unitLabel})` : `مبلغ پرداخت (${unitLabel})`}
                hint={`باقی‌مانده: ${canonicalInstallmentAmount(remaining)} ${unitLabel}${settleAsset ? ` · ${settleAsset.name}` : ''}`}
              >
                <AmountField value={settlementPayAmount} onValueChange={setSettlementPayAmount} unitLabel={unitLabel} />
              </Field>
              {!assetSettle && (
                <Field label="پرداخت از">
                  <PickerField
                    title="کیف پول پرداخت"
                    options={walletItems.map((w) => ({ value: w.id, label: w.label, description: w.sublabel }))}
                    value={settlementWalletId}
                    onValueChange={setSettlementWalletId}
                  />
                </Field>
              )}
            </div>
          </Sheet>
        );
      })()}
    </div>
  );
}
