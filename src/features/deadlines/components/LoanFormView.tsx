'use client';

import { useRateHistories, usdRateOn } from '@/features/rates/hooks/use-rate-histories';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AmountField, Banner, Button, Chip, ChipGroup, DateField, Field, Input, PickerField, SegmentedControl, Skeleton, Switch, Text, Textarea, TopBar } from '@/design-system';
import { useSafeBack } from '@/shared/hooks/use-safe-back';
import { categoryOptions, walletOptions } from '@/features/deadlines/v2/form-options';
import { useAuth, useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { useToast } from '@/shared/components/Toast';
import { supabase } from '@/shared/lib/supabase/client';
import type {
  Loan,
  LoanIntervalPeriod,
  LoanType,
  Transaction,
  Wallet,
} from '@/shared/types/domain';
import { formatJalaali, formatJalaaliHuman, parseJalaali, todayJalaali } from '@/shared/utils/jalali';
import { buildInstallmentSchedule } from '@/features/deadlines/utils/schedule';
import {
  LOAN_REMINDER_DAY_OPTIONS,
  normalizeReminderDaysBefore,
} from '@/features/deadlines/utils/loan-reminder-days';
import { CURRENCY_META } from '@/features/wallets/constants/currency-meta';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';

const INTERVAL_OPTIONS: { id: LoanIntervalPeriod; label: string }[] = [
  { id: 'day', label: 'روز' },
  { id: 'week', label: 'هفته' },
  { id: 'month', label: 'ماه' },
  { id: 'year', label: 'سال' },
];

type LoanDenomination = 'currency' | 'asset';

type LoanFormState = {
  title: string;
  type: LoanType;
  denomination: LoanDenomination;
  categoryId: string | null;
  currencyWalletId: string | null;
  assetId: string | null;
  totalAmount: string;
  installmentAmount: string;
  loanStartDate: string;
  firstDueDate: string;
  description: string;
  repeatCount: string;
  intervalNumber: string;
  intervalPeriod: LoanIntervalPeriod;
  autoIncomeOnCreate: boolean;
  autoIncomeWalletId: string | null;
  reminderDaysBefore: number[];
};

function initialState(): LoanFormState {
  const today = formatJalaali(todayJalaali());
  return {
    title: '',
    type: 'expense',
    denomination: 'currency',
    categoryId: null,
    currencyWalletId: null,
    assetId: null,
    totalAmount: '',
    installmentAmount: '',
    loanStartDate: today,
    firstDueDate: today,
    description: '',
    repeatCount: '12',
    intervalNumber: '1',
    intervalPeriod: 'month',
    autoIncomeOnCreate: false,
    autoIncomeWalletId: null,
    reminderDaysBefore: [3],
  };
}

export function LoanFormView({ loanId }: { loanId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { wallets, assets, categories, currencyRates, setTransactions } = useData();
  const { usdRate } = useUI();
  const rateHistories = useRateHistories();
  const isEdit = !!loanId;

  const [form, setForm] = useState<LoanFormState>(initialState);
  const [isLoading, setIsLoading] = useState<boolean>(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const goBack = useSafeBack('/deadlines/loans');


  const currencyWallet = wallets.find((wallet) => wallet.id === form.currencyWalletId) ?? null;
  const selectedAsset = assets.find((asset) => asset.id === form.assetId) ?? null;
  const amountUnitLabel =
    form.denomination === 'asset' && selectedAsset ? selectedAsset.unit : null;

  useEffect(() => {
    if (!isEdit || !loanId) return;
    let cancelled = false;
    const run = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('loans')
          .select('*')
          .eq('id', loanId)
          .single();
        if (error) throw error;
        if (cancelled) return;
        const loan = data as Loan;
        setForm({
          title: loan.title,
          type: loan.type,
          denomination: loan.asset_id ? 'asset' : 'currency',
          categoryId: loan.category_id,
          currencyWalletId: null,
          assetId: loan.asset_id,
          totalAmount: loan.total_amount != null ? String(loan.total_amount) : '',
          installmentAmount: String(loan.installment_amount),
          loanStartDate: loan.loan_start_date_string,
          firstDueDate: loan.first_due_date_string,
          description: loan.description ?? '',
          repeatCount: String(loan.repeat_count),
          intervalNumber: String(loan.interval_number),
          intervalPeriod: loan.interval_period,
          autoIncomeOnCreate: loan.auto_income_on_create,
          autoIncomeWalletId: loan.auto_income_wallet_id,
          reminderDaysBefore: normalizeReminderDaysBefore(loan.reminder_days_before ?? []),
        });
      } catch (error) {
        console.error(error);
        toast.error('خطا در دریافت اطلاعات وام.');
        router.back();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [isEdit, loanId, router, toast]);

  const validateCreate = () => {
    if (!form.title.trim()) return 'عنوان الزامی است.';
    if (!parseJalaali(form.loanStartDate)) return 'تاریخ شروع وام نامعتبر است.';
    if (!parseJalaali(form.firstDueDate)) return 'تاریخ اولین قسط نامعتبر است.';
    if (form.denomination === 'currency' && !form.currencyWalletId) {
      return 'کیف پول مبنا برای تعیین ارز وام الزامی است.';
    }
    if (form.denomination === 'asset' && !form.assetId) {
      return 'انتخاب دارایی وام الزامی است.';
    }
    if (form.type === 'expense' && !form.categoryId) return 'انتخاب دسته هزینه الزامی است.';

    const installmentAmount = Number(form.installmentAmount);
    const repeatCount = Number(form.repeatCount);
    const intervalNumber = Number(form.intervalNumber);
    if (!Number.isFinite(installmentAmount) || installmentAmount <= 0) {
      return form.denomination === 'asset' ? 'مقدار هر قسط نامعتبر است.' : 'مبلغ هر قسط نامعتبر است.';
    }
    if (!Number.isFinite(repeatCount) || repeatCount <= 0 || !Number.isInteger(repeatCount)) {
      return 'تعداد اقساط نامعتبر است.';
    }
    if (
      !Number.isFinite(intervalNumber) ||
      intervalNumber <= 0 ||
      !Number.isInteger(intervalNumber)
    ) {
      return 'فاصله تکرار نامعتبر است.';
    }
    if (
      form.type === 'loan' &&
      form.autoIncomeOnCreate &&
      form.denomination === 'currency' &&
      !form.autoIncomeWalletId
    ) {
      return 'برای تراکنش خودکار، کیف پول دریافت را انتخاب کن.';
    }
    if (
      form.type === 'loan' &&
      form.autoIncomeOnCreate &&
      form.denomination === 'asset'
    ) {
      const asset = assets.find((a) => a.id === form.assetId);
      if (!asset || !(Number(asset.price_toman) > 0)) {
        return 'برای ثبت خودکار، قیمت دارایی باید تنظیم شده باشد.';
      }
      if (!(usdRate > 0)) {
        return 'نرخ دلار برای ثبت خودکار در دسترس نیست.';
      }
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('کاربر معتبر نیست.');
      return;
    }

    if (isEdit) {
      if (!form.title.trim()) {
        toast.error('عنوان الزامی است.');
        return;
      }
      setIsSubmitting(true);
      try {
        const { error } = await supabase
          .from('loans')
          .update({
            title: form.title.trim(),
            description: form.description.trim() || null,
            reminder_days_before: normalizeReminderDaysBefore(form.reminderDaysBefore),
          })
          .eq('id', loanId);
        if (error) throw error;
        toast.success('وام ویرایش شد.');
        router.push('/deadlines/loans');
      } catch (error) {
        console.error(error);
        toast.error('خطا در ویرایش وام.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    const err = validateCreate();
    if (err) {
      toast.error(err);
      return;
    }

    const repeatCount = Number(form.repeatCount);
    const intervalNumber = Number(form.intervalNumber);
    const installmentAmount = Number(form.installmentAmount);
    const totalAmount =
      form.type === 'loan' && form.totalAmount.trim()
        ? Number(form.totalAmount)
        : installmentAmount * repeatCount;
    const isAssetDenom = form.denomination === 'asset';
    const baseWallet = isAssetDenom
      ? null
      : (wallets.find((wallet) => wallet.id === form.currencyWalletId) as Wallet);
    const loanAsset = isAssetDenom
      ? assets.find((asset) => asset.id === form.assetId) ?? null
      : null;
    const schedule = buildInstallmentSchedule({
      firstDueDate: form.firstDueDate,
      repeatCount,
      intervalNumber,
      intervalPeriod: form.intervalPeriod,
    });
    if (schedule.length !== repeatCount) {
      toast.error('برنامه اقساط قابل تولید نیست.');
      return;
    }

    setIsSubmitting(true);
    try {
      const loanPayload = {
        user_id: user.id,
        title: form.title.trim(),
        type: form.type,
        category_id: form.type === 'expense' ? form.categoryId : null,
        // ponytail: currency NOT NULL — IRT placeholder when asset-denominated
        currency: isAssetDenom ? ('IRT' as const) : baseWallet!.currency,
        asset_id: isAssetDenom ? form.assetId : null,
        installment_amount: installmentAmount,
        total_amount: Number.isFinite(totalAmount) ? totalAmount : null,
        loan_start_date_string: form.loanStartDate,
        first_due_date_string: form.firstDueDate,
        repeat_count: repeatCount,
        interval_number: intervalNumber,
        interval_period: form.intervalPeriod,
        // Asset path: credit via asset_id (wallet null). Needs
        // 20250804130000_loan_auto_income_asset_check migration if
        // auto_income_on_create is true; without it leave flag false.
        auto_income_on_create:
          form.type === 'loan' && form.autoIncomeOnCreate && !isAssetDenom,
        auto_income_wallet_id:
          form.type === 'loan' && form.autoIncomeOnCreate && !isAssetDenom
            ? form.autoIncomeWalletId
            : null,
        description: form.description.trim() || null,
        reminder_days_before: normalizeReminderDaysBefore(form.reminderDaysBefore),
        deleted_at: null,
      };
      const { data: loanData, error: loanErr } = await supabase
        .from('loans')
        .insert(loanPayload)
        .select()
        .single();
      if (loanErr) throw loanErr;
      const loan = loanData as Loan;

      const installmentsPayload = schedule.map((dueDate, idx) => ({
        user_id: user.id,
        loan_id: loan.id,
        due_date_string: dueDate,
        amount: installmentAmount,
        sequence_no: idx + 1,
        is_paid: false,
        paid_at: null,
        paid_transaction_id: null,
      }));

      const { error: installmentErr } = await supabase
        .from('loan_installments')
        .insert(installmentsPayload);
      if (installmentErr) {
        // Do not leave a loan with no installments behind.
        await supabase.from('loans').delete().eq('id', loan.id);
        throw installmentErr;
      }

      if (form.type === 'loan' && form.autoIncomeOnCreate) {
        // USD snapshot at the rate of the loan start date, not today's.
        const incomeUsdRate = usdRateOn(rateHistories, form.loanStartDate, formatJalaali(todayJalaali()), usdRate);
        if (isAssetDenom && loanAsset) {
          const qty = Number(totalAmount);
          const priceToman = Number(loanAsset.price_toman);
          const txPayload = {
            user_id: user.id,
            type: 'INCOME',
            date_string: form.loanStartDate,
            note: `وام: ${form.title.trim()}`,
            source_wallet_id: null,
            source_asset_id: null,
            target_wallet_id: null,
            target_asset_id: loanAsset.id,
            source_amount: null,
            target_amount: qty,
            category_id: null,
            asset_id: loanAsset.id,
            amount: qty,
            price_toman: priceToman,
            usd_rate: incomeUsdRate,
            amount_toman_at_time: qty * priceToman,
            amount_usd_at_time: incomeUsdRate > 0 ? (qty * priceToman) / incomeUsdRate : null,
          };
          const { data: txData, error: txErr } = await supabase
            .from('transactions')
            .insert(txPayload)
            .select()
            .single();
          if (txErr) throw txErr;
          setTransactions((prev) => [txData as Transaction, ...prev]);
        } else if (form.autoIncomeWalletId) {
          const incomeWallet = wallets.find((wallet) => wallet.id === form.autoIncomeWalletId);
          if (incomeWallet) {
            const rate = tomanPerUnit(incomeWallet.currency, currencyRates);
            const txPayload = {
              user_id: user.id,
              type: 'INCOME',
              date_string: form.loanStartDate,
              note: `وام: ${form.title.trim()}`,
              source_wallet_id: null,
              source_asset_id: null,
              target_wallet_id: incomeWallet.id,
              target_asset_id: null,
              source_amount: null,
              target_amount: Number(totalAmount),
              category_id: null,
              asset_id: null,
              amount: null,
              price_toman: incomeWallet.currency === 'IRT' ? null : rate,
              usd_rate: incomeWallet.currency === 'IRT' ? null : incomeUsdRate,
              amount_toman_at_time: Number(totalAmount) * rate,
              amount_usd_at_time: incomeUsdRate > 0 ? (Number(totalAmount) * rate) / incomeUsdRate : null,
            };
            const { data: txData, error: txErr } = await supabase
              .from('transactions')
              .insert(txPayload)
              .select()
              .single();
            if (txErr) throw txErr;
            setTransactions((prev) => [txData as Transaction, ...prev]);
          }
        }
      }

      toast.success('وام با برنامه اقساط ثبت شد.');
      router.push('/deadlines/loans');
    } catch (error) {
      console.error(error);
      toast.error('خطا در ثبت وام.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-full bg-canvas">
        <TopBar onBack={() => goBack()} title="وام" />
        <div className="space-y-3 px-(--ds-gutter)">
          <Skeleton className="h-12 rounded-control" />
          <Skeleton className="h-12 rounded-control" />
        </div>
      </div>
    );
  }

  const repeatPreviewCount = Number(form.repeatCount);
  const repeatPreviewInterval = Number(form.intervalNumber);
  const previewDates =
    repeatPreviewCount > 0 &&
    repeatPreviewCount <= 3 &&
    repeatPreviewInterval > 0 &&
    parseJalaali(form.firstDueDate)
      ? buildInstallmentSchedule({
          firstDueDate: form.firstDueDate,
          repeatCount: repeatPreviewCount,
          intervalNumber: repeatPreviewInterval,
          intervalPeriod: form.intervalPeriod,
        })
      : [];

  const set = <K extends keyof LoanFormState>(k: K, v: LoanFormState[K]) => setForm((prev) => ({ ...prev, [k]: v }));
  const digitsOnly = (v: string) => v.replace(/[^\d۰-۹]/g, '');

  return (
    <div className="min-h-full bg-canvas pb-10">
      <TopBar onBack={() => goBack()} title={isEdit ? 'ویرایش وام' : 'وام جدید'} />
      <form onSubmit={handleSubmit} className="space-y-4 px-(--ds-gutter)">
        {isEdit && <Banner tone="info">بعد از ثبت وام فقط عنوان، توضیحات و یادآوری‌ها قابل ویرایش است.</Banner>}
        <Field label="عنوان">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="مثال: خرید لپ‌تاپ" required />
        </Field>
        <Field label="نوع وام">
          <SegmentedControl
            aria-label="نوع وام"
            value={form.type}
            disabled={isEdit}
            onValueChange={(v) => set('type', v as LoanType)}
            options={[
              { value: 'expense', label: 'خرید اعتباری' },
              { value: 'loan', label: 'وام نقدی' },
            ]}
          />
        </Field>
        {!isEdit && (
          <Field label="واحد وام">
            <SegmentedControl
              aria-label="واحد وام"
              value={form.denomination}
              onValueChange={(v) =>
                setForm((prev) =>
                  v === 'currency'
                    ? { ...prev, denomination: 'currency', assetId: null, autoIncomeOnCreate: false, autoIncomeWalletId: null }
                    : { ...prev, denomination: 'asset', currencyWalletId: null, autoIncomeWalletId: null }
                )
              }
              options={[
                { value: 'currency', label: 'پول (ارز)' },
                { value: 'asset', label: 'دارایی (مثلاً طلا)' },
              ]}
            />
          </Field>
        )}
        {!isEdit && form.denomination === 'currency' && (
          <Field label="کیف پول مبنا (ارز وام)">
            <PickerField title="کیف پول مبنا" options={walletOptions(wallets)} value={form.currencyWalletId} onValueChange={(v) => set('currencyWalletId', v)} />
          </Field>
        )}
        {!isEdit && form.denomination === 'asset' && (
          <Field label="دارایی وام">
            <PickerField
              title="دارایی وام"
              options={assets.map((a) => ({ value: a.id, label: a.name, description: a.unit }))}
              value={form.assetId}
              onValueChange={(v) => set('assetId', v)}
            />
          </Field>
        )}
        {isEdit && form.denomination === 'asset' && selectedAsset && (
          <Text variant="caption" tone="subtle">
            دارایی وام: {selectedAsset.name} · {selectedAsset.unit}
          </Text>
        )}
        {form.type === 'expense' && (
          <Field label="دسته هزینه">
            <PickerField title="دسته هزینه" disabled={isEdit} options={categoryOptions(categories, 'expense')} value={form.categoryId} onValueChange={(v) => set('categoryId', v)} />
          </Field>
        )}
        {form.type === 'loan' && (
          <>
            <Field label={form.denomination === 'asset' ? `مقدار کل وام${amountUnitLabel ? ` (${amountUnitLabel})` : ''}` : 'مبلغ کل وام'}>
              <AmountField value={form.totalAmount} onValueChange={(v) => set('totalAmount', v)} readOnly={isEdit} unitLabel={amountUnitLabel ?? undefined} />
            </Field>
            {!isEdit && (
              <div className="space-y-3 rounded-card bg-panel p-4">
                <Switch
                  label={form.denomination === 'asset' ? 'ثبت دریافت دارایی خودکار' : 'ثبت تراکنش درآمد خودکار'}
                  description={form.denomination === 'asset' ? 'کل مقدار وام به‌صورت درآمد روی همین دارایی ثبت می‌شود.' : undefined}
                  checked={form.autoIncomeOnCreate}
                  onCheckedChange={(on) => setForm((prev) => ({ ...prev, autoIncomeOnCreate: on, autoIncomeWalletId: on ? prev.autoIncomeWalletId : null }))}
                />
                {form.autoIncomeOnCreate && form.denomination === 'currency' && (
                  <Field label="کیف پول دریافت">
                    <PickerField title="کیف پول دریافت" options={walletOptions(wallets)} value={form.autoIncomeWalletId} onValueChange={(v) => set('autoIncomeWalletId', v)} />
                  </Field>
                )}
              </div>
            )}
          </>
        )}
        <Field label={form.denomination === 'asset' ? `مقدار هر قسط${amountUnitLabel ? ` (${amountUnitLabel})` : ''}` : 'مبلغ هر قسط'}>
          <AmountField value={form.installmentAmount} onValueChange={(v) => set('installmentAmount', v)} readOnly={isEdit} unitLabel={amountUnitLabel ?? (currencyWallet && currencyWallet.currency !== 'IRT' ? CURRENCY_META[currencyWallet.currency].label : undefined)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="تاریخ شروع وام">
            {isEdit ? <Input value={form.loanStartDate} readOnly dir="ltr" /> : <DateField value={form.loanStartDate} onValueChange={(v) => set('loanStartDate', v)} quickChips={false} />}
          </Field>
          <Field label="تاریخ اولین قسط">
            {isEdit ? <Input value={form.firstDueDate} readOnly dir="ltr" /> : <DateField value={form.firstDueDate} onValueChange={(v) => set('firstDueDate', v)} quickChips={false} />}
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="تعداد اقساط">
            <Input value={form.repeatCount} onChange={(e) => set('repeatCount', digitsOnly(e.target.value))} inputMode="numeric" dir="ltr" required readOnly={isEdit} />
          </Field>
          <Field label="فاصله تکرار">
            <Input value={form.intervalNumber} onChange={(e) => set('intervalNumber', digitsOnly(e.target.value))} inputMode="numeric" dir="ltr" required readOnly={isEdit} />
          </Field>
        </div>
        <Field label="واحد فاصله">
          <SegmentedControl
            aria-label="واحد فاصله"
            value={form.intervalPeriod}
            disabled={isEdit}
            onValueChange={(v) => set('intervalPeriod', v as LoanIntervalPeriod)}
            options={INTERVAL_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
          />
        </Field>
        <Field label="یادآوری تلگرام قبل از سررسید" hint="علاوه بر پیام روز سررسید، در این فاصله‌ها هم یادآوری می‌گیری.">
          <ChipGroup
            aria-label="روزهای یادآوری"
            multiple
            value={form.reminderDaysBefore.map(String)}
            onValueChange={(v) => set('reminderDaysBefore', normalizeReminderDaysBefore(v.map(Number)))}
          >
            {LOAN_REMINDER_DAY_OPTIONS.map((days) => (
              <Chip key={days} value={String(days)}>
                {days.toLocaleString('fa-IR')} روز قبل
              </Chip>
            ))}
          </ChipGroup>
        </Field>
        {previewDates.length > 0 && (
          <div className="space-y-1 rounded-card bg-panel p-3">
            <Text variant="caption" tone="subtle">
              پیش‌نمایش سررسیدها
            </Text>
            {previewDates.map((date) => (
              <p key={date} className="text-caption text-fg">
                {parseJalaali(date) ? formatJalaaliHuman(parseJalaali(date)!) : date}
              </p>
            ))}
          </div>
        )}
        <Field label="توضیحات">
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={2} placeholder="اختیاری" />
        </Field>
        <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
          {isEdit ? 'ثبت تغییرات' : 'ایجاد وام'}
        </Button>
      </form>
    </div>
  );
}
