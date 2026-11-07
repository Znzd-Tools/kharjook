'use client';

import {
  ChoiceChips,
  Field,
  FormSection,
  PageHeader,
  PickerRow,
  PrimaryButton,
  SegmentedControl,
  StickyFooter,
  SwitchVisual,
  fieldInputClass,
} from '@/shared/components/ui';
import { useRateHistories, usdRateOn } from '@/features/rates/hooks/use-rate-histories';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar } from 'lucide-react';
import { useAuth, useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { useToast } from '@/shared/components/Toast';
import { supabase } from '@/shared/lib/supabase/client';
import { FormattedNumberInput } from '@/shared/components/FormattedNumberInput';
import { IOSDatePicker } from '@/shared/components/IOSDatePicker';
import { CategorySheetPicker } from '@/shared/components/CategorySheetPicker';
import { ListSheetPicker } from '@/shared/components/ListSheetPicker';
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
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [currencyWalletOpen, setCurrencyWalletOpen] = useState(false);
  const [assetOpen, setAssetOpen] = useState(false);
  const [autoWalletOpen, setAutoWalletOpen] = useState(false);
  const [loanStartDateOpen, setLoanStartDateOpen] = useState(false);
  const [firstDueDateOpen, setFirstDueDateOpen] = useState(false);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.kind === 'expense'),
    [categories]
  );

  const currencyWallet = wallets.find((wallet) => wallet.id === form.currencyWalletId) ?? null;
  const selectedAsset = assets.find((asset) => asset.id === form.assetId) ?? null;
  const autoIncomeWallet =
    wallets.find((wallet) => wallet.id === form.autoIncomeWalletId) ?? null;
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
      <div className="p-6 text-center text-zinc-500 animate-pulse">
        در حال دریافت...
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

  const human = (v: string) => (parseJalaali(v) ? formatJalaaliHuman(parseJalaali(v)!) : v);
  const unitSuffix = form.denomination === 'asset' && amountUnitLabel ? ` (${amountUnitLabel})` : '';

  return (
    <div className="bg-surface-shell min-h-full animate-[slide-fade-in-up_300ms_ease-out]">
      <PageHeader
        title={isEdit ? 'ویرایش وام' : 'وام جدید'}
        subtitle={isEdit ? 'فقط عنوان، توضیحات و یادآوری‌ها قابل ویرایش است' : undefined}
      />

      <form onSubmit={handleSubmit} className="px-4 pt-5 space-y-6">
        <FormSection title="نوع وام">
          <Field label="عنوان">
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className={fieldInputClass}
              placeholder="مثلاً خرید لپ‌تاپ"
              required
            />
          </Field>
          <div className={isEdit ? 'pointer-events-none opacity-60' : ''}>
            <SegmentedControl
              value={form.type}
              onChange={(type) => setForm((prev) => ({ ...prev, type }))}
              options={[
                { value: 'expense', label: 'خرید اعتباری' },
                { value: 'loan', label: 'وام نقدی' },
              ]}
            />
          </div>
          {!isEdit && (
            <Field label="واحد وام">
              <SegmentedControl
                size="sm"
                value={form.denomination}
                onChange={(denomination) =>
                  setForm((prev) =>
                    denomination === 'currency'
                      ? { ...prev, denomination, assetId: null, autoIncomeOnCreate: false, autoIncomeWalletId: null }
                      : { ...prev, denomination, currencyWalletId: null, autoIncomeWalletId: null }
                  )
                }
                options={[
                  { value: 'currency', label: 'پول (ارز)' },
                  { value: 'asset', label: 'دارایی' },
                ]}
              />
            </Field>
          )}
          {!isEdit && form.denomination === 'currency' && (
            <PickerRow
              label="کیف پول مبنا"
              value={currencyWallet ? `${currencyWallet.name} · ${currencyWallet.currency}` : null}
              onClick={() => setCurrencyWalletOpen(true)}
            />
          )}
          {!isEdit && form.denomination === 'asset' && (
            <PickerRow
              label="دارایی وام"
              value={selectedAsset ? `${selectedAsset.name} · ${selectedAsset.unit}` : null}
              onClick={() => setAssetOpen(true)}
            />
          )}
          {isEdit && form.denomination === 'asset' && selectedAsset && (
            <PickerRow label="دارایی وام" value={`${selectedAsset.name} · ${selectedAsset.unit}`} disabled onClick={() => {}} />
          )}
          {form.type === 'expense' && (
            <PickerRow
              label="دسته هزینه"
              value={form.categoryId ? expenseCategories.find((c) => c.id === form.categoryId)?.name : null}
              disabled={isEdit}
              onClick={() => setCategoryOpen(true)}
            />
          )}
        </FormSection>

        <FormSection title="مبلغ">
          {form.type === 'loan' && (
            <Field label={`${form.denomination === 'asset' ? 'مقدار' : 'مبلغ'} کل وام${unitSuffix}`}>
              <FormattedNumberInput
                value={form.totalAmount}
                onValueChange={(value) => setForm((prev) => ({ ...prev, totalAmount: value }))}
                className={`${fieldInputClass} text-left`}
                dir="ltr"
                placeholder="0"
                disabled={isEdit}
              />
            </Field>
          )}
          <Field label={`${form.denomination === 'asset' ? 'مقدار' : 'مبلغ'} هر قسط${unitSuffix}`}>
            <FormattedNumberInput
              value={form.installmentAmount}
              onValueChange={(value) => setForm((prev) => ({ ...prev, installmentAmount: value }))}
              className={`${fieldInputClass} text-left text-lg font-semibold`}
              dir="ltr"
              placeholder="0"
              required
              disabled={isEdit}
            />
          </Field>
          {form.type === 'loan' && !isEdit && (
            <>
              <button
                type="button"
                role="switch"
                aria-checked={form.autoIncomeOnCreate}
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    autoIncomeOnCreate: !prev.autoIncomeOnCreate,
                    autoIncomeWalletId: !prev.autoIncomeOnCreate ? prev.autoIncomeWalletId : null,
                  }))
                }
                className="flex w-full items-center justify-between gap-3 rounded-xl bg-white/4 px-4 py-3 text-right"
              >
                <span className="text-sm text-zinc-200">
                  {form.denomination === 'asset' ? 'ثبت خودکار دریافت دارایی' : 'ثبت خودکار درآمد وام'}
                </span>
                <SwitchVisual checked={form.autoIncomeOnCreate} />
              </button>
              {form.autoIncomeOnCreate && form.denomination === 'currency' && (
                <PickerRow
                  label="کیف پول دریافت"
                  value={autoIncomeWallet ? `${autoIncomeWallet.name} · ${autoIncomeWallet.currency}` : null}
                  onClick={() => setAutoWalletOpen(true)}
                />
              )}
              {form.autoIncomeOnCreate && form.denomination === 'asset' && (
                <p className="text-xs leading-relaxed text-zinc-500">
                  کل مقدار وام به‌صورت درآمد روی همین دارایی ثبت می‌شود.
                </p>
              )}
            </>
          )}
        </FormSection>

        <FormSection title="زمان‌بندی">
          <div className="grid grid-cols-2 gap-3">
            <PickerRow
              label="شروع وام"
              value={human(form.loanStartDate)}
              leading={<Calendar size={15} />}
              disabled={isEdit}
              onClick={() => setLoanStartDateOpen(true)}
            />
            <PickerRow
              label="اولین قسط"
              value={human(form.firstDueDate)}
              leading={<Calendar size={15} />}
              disabled={isEdit}
              onClick={() => setFirstDueDateOpen(true)}
            />
          </div>
          <Field label="تعداد اقساط">
            <FormattedNumberInput
              value={form.repeatCount}
              onValueChange={(value) => setForm((prev) => ({ ...prev, repeatCount: value }))}
              className={`${fieldInputClass} text-left`}
              dir="ltr"
              required
              disabled={isEdit}
            />
          </Field>
          <Field label="فاصله اقساط">
            <div className={`flex items-center gap-2 ${isEdit ? 'pointer-events-none opacity-60' : ''}`}>
              <span className="text-sm text-zinc-400">هر</span>
              <FormattedNumberInput
                value={form.intervalNumber}
                onValueChange={(value) => setForm((prev) => ({ ...prev, intervalNumber: value }))}
                className={`${fieldInputClass} w-16! text-center`}
                dir="ltr"
                required
                disabled={isEdit}
              />
              <SegmentedControl
                size="sm"
                className="flex-1"
                value={form.intervalPeriod}
                onChange={(intervalPeriod) => setForm((prev) => ({ ...prev, intervalPeriod }))}
                options={INTERVAL_OPTIONS.map((option) => ({ value: option.id, label: option.label }))}
              />
            </div>
          </Field>
          {previewDates.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-zinc-500">سررسیدهای اول</p>
              <div className="flex flex-wrap gap-1.5">
                {previewDates.map((date) => (
                  <span key={date} className="rounded-full bg-white/6 px-2.5 py-1 text-xs text-zinc-300">
                    {human(date)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </FormSection>

        <FormSection title="یادآوری تلگرام" description="علاوه بر روز سررسید، این روزها هم پیام می‌گیری.">
          <ChoiceChips
            multiple
            value={form.reminderDaysBefore}
            onChange={(days) =>
              setForm((prev) => ({
                ...prev,
                reminderDaysBefore: prev.reminderDaysBefore.includes(days)
                  ? prev.reminderDaysBefore.filter((d) => d !== days)
                  : normalizeReminderDaysBefore([...prev.reminderDaysBefore, days]),
              }))
            }
            options={LOAN_REMINDER_DAY_OPTIONS.map((days) => ({ value: days, label: `${days} روز قبل` }))}
          />
        </FormSection>

        <FormSection title="توضیحات">
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            rows={3}
            placeholder="اختیاری"
            className={`${fieldInputClass} resize-none`}
          />
        </FormSection>

        <StickyFooter>
          <PrimaryButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'در حال ثبت...' : isEdit ? 'ذخیره تغییرات' : 'ایجاد وام'}
          </PrimaryButton>
        </StickyFooter>
      </form>

      <CategorySheetPicker
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        title="انتخاب دسته هزینه"
        kind="expense"
        categories={categories}
        value={form.categoryId}
        onSelect={(id) => setForm((prev) => ({ ...prev, categoryId: id }))}
      />

      <ListSheetPicker
        open={currencyWalletOpen}
        onClose={() => setCurrencyWalletOpen(false)}
        title="انتخاب کیف پول مبنا"
        items={wallets.map((wallet) => ({
          id: wallet.id,
          label: wallet.name,
          sublabel: `${CURRENCY_META[wallet.currency].label} · ${wallet.currency}`,
        }))}
        value={form.currencyWalletId}
        onSelect={(id) => setForm((prev) => ({ ...prev, currencyWalletId: id }))}
      />

      <ListSheetPicker
        open={assetOpen}
        onClose={() => setAssetOpen(false)}
        title="انتخاب دارایی وام"
        items={assets.map((asset) => ({
          id: asset.id,
          label: asset.name,
          sublabel: asset.unit,
        }))}
        value={form.assetId}
        onSelect={(id) => setForm((prev) => ({ ...prev, assetId: id }))}
      />

      <ListSheetPicker
        open={autoWalletOpen}
        onClose={() => setAutoWalletOpen(false)}
        title="انتخاب کیف پول دریافت"
        items={wallets.map((wallet) => ({
          id: wallet.id,
          label: wallet.name,
          sublabel: `${CURRENCY_META[wallet.currency].label} · ${wallet.currency}`,
        }))}
        value={form.autoIncomeWalletId}
        onSelect={(id) => setForm((prev) => ({ ...prev, autoIncomeWalletId: id }))}
      />

      <IOSDatePicker
        open={loanStartDateOpen}
        onClose={() => setLoanStartDateOpen(false)}
        value={form.loanStartDate}
        onChange={(value) => setForm((prev) => ({ ...prev, loanStartDate: value }))}
      />
      <IOSDatePicker
        open={firstDueDateOpen}
        onClose={() => setFirstDueDateOpen(false)}
        value={form.firstDueDate}
        onChange={(value) => setForm((prev) => ({ ...prev, firstDueDate: value }))}
      />
    </div>
  );
}
