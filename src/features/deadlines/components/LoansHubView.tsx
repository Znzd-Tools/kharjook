'use client';

import { BottomSheet } from '@/shared/components/BottomSheet';
import { EmptyState } from '@/shared/components/EmptyState';
import {
  ActionSheet,
  Card,
  ChoiceChips,
  Field,
  HeaderAction,
  IconBadge,
  ListGroup,
  ListRow,
  Money,
  PageHeader,
  PickerRow,
  PrimaryButton,
  ProgressBar,
  SegmentedControl,
  Section,
  fieldInputClass,
} from '@/shared/components/ui';
import { useRateHistories, usdRateOn } from '@/features/rates/hooks/use-rate-histories';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarClock,
  CheckCircle2,
  Pencil,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Trash2,
} from 'lucide-react';
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
import { ListSheetPicker } from '@/shared/components/ListSheetPicker';
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
type LoanFilter = 'all' | 'remaining' | 'finished';
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
  const [actionLoanId, setActionLoanId] = useState<string | null>(null);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [installments, setInstallments] = useState<LoanInstallment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [settlementTarget, setSettlementTarget] = useState<LoanInstallment | null>(null);
  const [settlementWalletId, setSettlementWalletId] = useState<string | null>(null);
  const [settlementPayAmount, setSettlementPayAmount] = useState('');
  const [isSettlementPickerOpen, setIsSettlementPickerOpen] = useState(false);
  const [loanFilter, setLoanFilter] = useState<LoanFilter>('remaining');
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
  const filteredLoanRows = useMemo(() => {
    if (loanFilter === 'all') return loansRows;
    if (loanFilter === 'finished') {
      return loansRows.filter((row) => row.totalCount > 0 && row.paidCount >= row.totalCount);
    }
    return loansRows.filter((row) => row.totalCount === 0 || row.paidCount < row.totalCount);
  }, [loanFilter, loansRows]);

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
    const loan = loansById.get(installment.loan_id);
    setSettlementTarget(installment);
    setSettlementWalletId(null);
    setSettlementPayAmount(canonicalInstallmentAmount(installmentRemainingAmount(installment)));
    // Asset loans need no wallet pick — open confirm bar only.
    setIsSettlementPickerOpen(loan ? !isAssetLoan(loan) : true);
  };

  const closeSettle = () => {
    setSettlementTarget(null);
    setSettlementWalletId(null);
    setSettlementPayAmount('');
    setIsSettlementPickerOpen(false);
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

  const actionLoan = loansRows.find((r) => r.loan.id === actionLoanId)?.loan ?? null;
  const navBtn =
    'inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-white/6 hover:text-zinc-100';

  const renderInstallmentRow = (
    { installment, loan }: { installment: LoanInstallment; loan: Loan },
    showDue: boolean
  ) => {
    const parsed = parseJalaali(installment.due_date_string);
    const dueLabel = parsed ? formatJalaaliHuman(parsed) : installment.due_date_string;
    const meta = installmentMetaByLoan.get(loan.id);
    const total = meta?.total ?? installment.sequence_no;
    const isLast = installment.sequence_no === (meta?.lastSeq ?? installment.sequence_no);
    const amount = isAssetLoan(loan)
      ? formatLoanQty(installment.is_paid ? installment.amount : installmentRemainingAmount(installment), loan)
      : formatCurrency(displayAmount({ installment, loan }), currencyMode);
    return (
      <ListRow
        key={installment.id}
        onClick={installment.is_paid ? undefined : () => openSettle(installment)}
        className={installment.is_paid ? 'opacity-60' : ''}
        leading={
          <IconBadge color={installment.is_paid ? '#34d399' : '#fbbf24'}>
            {installment.is_paid ? <CheckCircle2 size={17} strokeWidth={1.9} /> : <CalendarClock size={17} strokeWidth={1.9} />}
          </IconBadge>
        }
        title={
          <span className="flex items-center gap-1.5">
            <span className="truncate">{loan.title}</span>
            <span className="shrink-0 text-xs font-normal text-zinc-500" dir="ltr">
              {toPersianDigits(`${installment.sequence_no}/${total}`)}
            </span>
            {isLast && (
              <span className="shrink-0 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                آخرین
              </span>
            )}
          </span>
        }
        subtitle={[showDue ? dueLabel : null, installmentHasPartialPay(installment) ? 'پرداخت جزئی' : null]
          .filter(Boolean)
          .join(' · ') || undefined}
        trailing={<Money>{amount}</Money>}
        trailingSub={installment.is_paid ? <span className="text-emerald-400">تسویه‌شده</span> : <span className="text-zinc-400">تسویه ›</span>}
      />
    );
  };

  return (
    <div className="px-4 pb-8 space-y-6 animate-[fade-in_250ms_ease-out]">
      <PageHeader
        className="-mx-4"
        title="اقساط و وام‌ها"
        actions={<HeaderAction label="وام جدید" href="/deadlines/loans/new" />}
      />

      {remainingTotalDisplay > 0 && (
        <div className="px-1">
          <p className="text-xs text-zinc-500">جمع اقساط باقی‌مانده</p>
          <p className="mt-1 text-[1.75rem] leading-tight font-semibold tracking-tight text-zinc-50">
            <Money>{formatCurrency(remainingTotalDisplay, currencyMode)}</Money>
          </p>
        </div>
      )}

      <SegmentedControl
        value={tab}
        onChange={setTab}
        options={[
          { value: 'loans', label: 'وام‌ها' },
          { value: 'installments', label: 'اقساط' },
          { value: 'calendar', label: 'تقویم' },
        ]}
      />

      {isLoading ? (
        <div className="py-10 text-center text-zinc-500 animate-pulse">در حال دریافت...</div>
      ) : tab === 'loans' ? (
        loansRows.length === 0 ? (
          <EmptyState
            icon={<CalendarClock size={22} />}
            title="هنوز وامی ثبت نشده."
            description="وام یا خرید اقساطی را ثبت کن تا اقساطش خودکار برنامه‌ریزی شود."
            actionLabel="ایجاد اولین وام"
            onAction={() => router.push('/deadlines/loans/new')}
          />
        ) : (
          <div className="space-y-3">
            <ChoiceChips
              value={loanFilter}
              onChange={setLoanFilter}
              options={[
                { value: 'remaining', label: 'باقی‌مانده' },
                { value: 'finished', label: 'تمام‌شده' },
                { value: 'all', label: 'همه' },
              ]}
            />
            {filteredLoanRows.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">موردی با این فیلتر نیست.</p>
            ) : (
              <ListGroup>
                {filteredLoanRows.map(({ loan, paidCount, totalCount }) => {
                  const category = loan.category_id ? categories.find((c) => c.id === loan.category_id) : null;
                  const loanAsset = isAssetLoan(loan) ? assetsById.get(loan.asset_id!) ?? null : null;
                  const totalDisplay = loan.total_amount ?? loan.installment_amount * loan.repeat_count;
                  const progressPercent = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;
                  return (
                    <button
                      key={loan.id}
                      type="button"
                      onClick={() => setActionLoanId(loan.id)}
                      className="block w-full px-4 py-3.5 text-right transition-colors hover:bg-surface-hover"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-100">{loan.title}</p>
                          <p className="mt-0.5 truncate text-xs text-zinc-500">
                            {[loan.type === 'expense' ? 'خرید اعتباری' : 'وام نقدی', loanAsset?.name ?? category?.name]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        <div className="shrink-0 text-left">
                          <p className="text-sm font-semibold text-zinc-100">
                            <Money>{formatLoanQty(loan.installment_amount, loan)}</Money>
                          </p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            از <Money>{formatLoanQty(totalDisplay, loan)}</Money>
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex-1">
                          <ProgressBar value={progressPercent} tone={progressPercent >= 100 ? 'positive' : 'accent'} />
                        </div>
                        <span className="shrink-0 text-xs text-zinc-400">
                          {toPersianDigits(paidCount)} از {toPersianDigits(totalCount)} قسط
                        </span>
                      </div>
                    </button>
                  );
                })}
              </ListGroup>
            )}
          </div>
        )
      ) : tab === 'installments' ? (
        installmentRows.length === 0 ? (
          <EmptyState
            icon={<CalendarClock size={22} />}
            title="قسطی برای نمایش نیست."
            description="بعد از ثبت وام، برنامه اقساط اینجا نمایش داده می‌شود."
          />
        ) : (
          <div className="space-y-5">
            <ChoiceChips
              value={installmentFilter}
              onChange={setInstallmentFilter}
              options={[
                { value: 'remaining', label: 'باقی‌مانده' },
                { value: 'paid', label: 'تسویه‌شده' },
                { value: 'all', label: 'همه' },
              ]}
            />
            {groupedInstallments.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500">موردی با این فیلتر نیست.</p>
            ) : (
              groupedInstallments.map((group) => (
                <Section
                  key={group.key}
                  title={group.label}
                  description={<Money>{formatCurrency(group.total, currencyMode)}</Money>}
                >
                  <ListGroup>{group.rows.map((row) => renderInstallmentRow(row, true))}</ListGroup>
                </Section>
              ))
            )}
          </div>
        )
      ) : (
        <div className="space-y-5">
          <Card className="space-y-3">
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => moveCalendarMonth(-1)} className={navBtn} aria-label="ماه قبل">
                <ChevronRight size={17} />
              </button>
              <div className="text-center">
                <p className="text-sm font-semibold text-zinc-100">
                  {JALALI_MONTHS[calendarMonth.jm - 1]} {toPersianDigits(calendarMonth.jy)}
                </p>
                <p className="mt-0.5 text-xs text-zinc-500">
                  بدهی ماه <Money>{formatCurrency(monthRemainingTotal, currencyMode)}</Money>
                </p>
              </div>
              <button type="button" onClick={() => moveCalendarMonth(1)} className={navBtn} aria-label="ماه بعد">
                <ChevronLeft size={17} />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center">
              {WEEKDAY_LABELS.map((label) => (
                <div key={label} className="py-1 text-[11px] text-zinc-500">
                  {label}
                </div>
              ))}
              {calendarCells.map((cell, idx) => {
                if (!cell) return <div key={`empty-${idx}`} className="h-11" />;
                const isSelected = selectedCalendarDate === cell.date;
                const isToday = cell.date === todayStr;
                const hasRows = cell.rows.length > 0;
                const isOverdue = hasRows && cell.date < todayStr;
                return (
                  <button
                    type="button"
                    key={cell.date}
                    onClick={() => setSelectedCalendarDate(cell.date)}
                    className={`relative flex h-11 flex-col items-center justify-center rounded-xl text-xs transition-colors ${
                      isSelected
                        ? 'bg-zinc-50 font-semibold text-zinc-900'
                        : isToday
                          ? 'bg-white/8 text-zinc-50'
                          : 'text-zinc-300 hover:bg-white/5'
                    }`}
                  >
                    {toPersianDigits(cell.day)}
                    {hasRows && (
                      <span
                        className={`absolute bottom-1.5 h-1 w-1 rounded-full ${
                          isOverdue ? 'bg-rose-400' : isSelected ? 'bg-zinc-900' : 'bg-amber-400'
                        }`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </Card>

          <Section
            title={selectedDayLabel}
            description={selectedDayRows.length > 0 ? <Money>{formatCurrency(selectedRemainingTotal, currencyMode)}</Money> : undefined}
          >
            {selectedDayRows.length === 0 ? (
              <p className="py-4 text-center text-sm text-zinc-500">برای این روز قسطی نیست.</p>
            ) : (
              <ListGroup>{selectedDayRows.map((row) => renderInstallmentRow(row, false))}</ListGroup>
            )}
          </Section>
        </div>
      )}

      <ActionSheet
        open={actionLoan !== null}
        onClose={() => setActionLoanId(null)}
        title={actionLoan?.title}
        actions={
          actionLoan
            ? [
                {
                  label: 'ویرایش',
                  icon: <Pencil size={17} />,
                  onSelect: () => router.push(`/deadlines/loans/${actionLoan.id}/edit`),
                },
                {
                  label: 'حذف وام و اقساط',
                  icon: <Trash2 size={17} />,
                  tone: 'danger',
                  disabled: isSubmitting,
                  onSelect: () => void handleDeleteLoan(actionLoan),
                },
              ]
            : []
        }
      />

      <BottomSheet open={settlementTarget !== null} onClose={closeSettle} title="تسویه قسط">
        {settlementTarget &&
          (() => {
            const settleLoan = loansById.get(settlementTarget.loan_id);
            const assetSettle = settleLoan ? isAssetLoan(settleLoan) : false;
            const settleAsset =
              assetSettle && settleLoan?.asset_id ? assetsById.get(settleLoan.asset_id) ?? null : null;
            const unitLabel = assetSettle
              ? (settleAsset?.unit ?? 'واحد')
              : settleLoan
                ? CURRENCY_META[settleLoan.currency].label
                : '';
            const remaining = installmentRemainingAmount(settlementTarget);
            const canSubmit = assetSettle
              ? !!settlementPayAmount.trim()
              : !!settlementWalletId && !!settlementPayAmount.trim();
            return (
              <div className="space-y-4">
                {settleLoan && (
                  <p className="text-sm text-zinc-300">
                    {settleLoan.title} · قسط {toPersianDigits(settlementTarget.sequence_no)}
                  </p>
                )}
                <Field
                  label={`${assetSettle ? 'مقدار' : 'مبلغ'} پرداخت (${unitLabel})`}
                  hint={
                    <span dir="ltr">
                      باقی‌مانده: {canonicalInstallmentAmount(remaining)} {unitLabel}
                      {settleAsset ? ` · ${settleAsset.name}` : ''}
                    </span>
                  }
                >
                  <input
                    type="text"
                    inputMode="decimal"
                    value={settlementPayAmount}
                    onChange={(e) => setSettlementPayAmount(e.target.value)}
                    disabled={isSubmitting}
                    dir="ltr"
                    className={`${fieldInputClass} h-14 text-left text-2xl font-semibold`}
                  />
                </Field>
                {!assetSettle && (
                  <PickerRow
                    label="پرداخت از"
                    value={selectedSettlementWallet?.name}
                    placeholder="انتخاب کیف پول"
                    disabled={isSubmitting}
                    onClick={() => setIsSettlementPickerOpen(true)}
                  />
                )}
                <PrimaryButton onClick={handleSettle} disabled={isSubmitting || !canSubmit}>
                  {isSubmitting ? (
                    <>
                      <Loader2 size={15} className="animate-spin" />
                      در حال تسویه...
                    </>
                  ) : (
                    'ثبت پرداخت'
                  )}
                </PrimaryButton>
              </div>
            );
          })()}
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
