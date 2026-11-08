'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AmountField, Button, Chip, ChipGroup, DateField, Field, Input, PickerField, SegmentedControl, Skeleton, Textarea, TopBar } from '@/design-system';
import { useSafeBack } from '@/shared/hooks/use-safe-back';
import { CURRENCY_META } from '@/features/wallets/constants/currency-meta';
import { categoryOptions, walletOptions } from '@/features/deadlines/v2/form-options';
import { useAuth, useData } from '@/features/portfolio/PortfolioProvider';
import { useToast } from '@/shared/components/Toast';
import { supabase } from '@/shared/lib/supabase/client';
import type { LoanIntervalPeriod, Subscription, Wallet } from '@/shared/types/domain';
import { formatJalaali, parseJalaali, todayJalaali } from '@/shared/utils/jalali';
import {
  LOAN_REMINDER_DAY_OPTIONS,
  normalizeReminderDaysBefore,
} from '@/features/deadlines/utils/loan-reminder-days';
import { intervalLabel } from '@/features/transactions/utils/recurring-transaction-label';

const INTERVAL_OPTIONS: { id: LoanIntervalPeriod; label: string }[] = [
  { id: 'day', label: 'روز' },
  { id: 'week', label: 'هفته' },
  { id: 'month', label: 'ماه' },
  { id: 'year', label: 'سال' },
];

type SubscriptionFormState = {
  platform: string;
  amount: string;
  walletId: string | null;
  categoryId: string | null;
  nextDueDate: string;
  intervalNumber: string;
  intervalPeriod: LoanIntervalPeriod;
  reminderDaysBefore: number[];
  note: string;
};

function initialState(): SubscriptionFormState {
  return {
    platform: '',
    amount: '',
    walletId: null,
    categoryId: null,
    nextDueDate: formatJalaali(todayJalaali()),
    intervalNumber: '1',
    intervalPeriod: 'month',
    reminderDaysBefore: [],
    note: '',
  };
}

export function SubscriptionFormView({ subscriptionId }: { subscriptionId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { wallets, categories } = useData();
  const isEdit = !!subscriptionId;

  const [form, setForm] = useState<SubscriptionFormState>(initialState);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const goBack = useSafeBack('/deadlines/subscriptions');

  const selectedWallet = wallets.find((wallet) => wallet.id === form.walletId) ?? null;

  useEffect(() => {
    if (!isEdit || !subscriptionId) return;
    let cancelled = false;
    const run = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('id', subscriptionId)
          .is('deleted_at', null)
          .single();
        if (error) throw error;
        if (cancelled) return;
        const row = data as Subscription;
        setForm({
          platform: row.platform,
          amount: String(row.amount),
          walletId: row.wallet_id,
          categoryId: row.category_id,
          nextDueDate: row.next_due_date_string,
          intervalNumber: String(row.interval_number),
          intervalPeriod: row.interval_period,
          reminderDaysBefore: row.reminder_days_before ?? [],
          note: row.note ?? '',
        });
      } catch (error) {
        console.error(error);
        toast.error('خطا در دریافت اطلاعات اشتراک.');
        router.back();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [isEdit, router, subscriptionId, toast]);

  const validate = () => {
    if (!form.platform.trim()) return 'نام پلتفرم الزامی است.';
    if (!parseJalaali(form.nextDueDate)) return 'تاریخ سررسید نامعتبر است.';
    if (!form.walletId) return 'کیف پول پیش‌فرض الزامی است.';
    if (!form.categoryId) return 'انتخاب دسته هزینه الزامی است.';
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) return 'مبلغ نامعتبر است.';
    const intervalNumber = Number(form.intervalNumber);
    if (!Number.isInteger(intervalNumber) || intervalNumber <= 0) return 'فاصله تکرار نامعتبر است.';
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('کاربر معتبر نیست.');
      return;
    }

    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    const baseWallet = wallets.find((wallet) => wallet.id === form.walletId) as Wallet;
    const amount = Number(form.amount);
    const intervalNumber = Number(form.intervalNumber);

    setIsSubmitting(true);
    try {
      const payload = {
        platform: form.platform.trim(),
        amount,
        currency: baseWallet.currency,
        interval_number: intervalNumber,
        interval_period: form.intervalPeriod,
        next_due_date_string: form.nextDueDate,
        wallet_id: form.walletId,
        category_id: form.categoryId,
        reminder_days_before: normalizeReminderDaysBefore(form.reminderDaysBefore),
        note: form.note.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (isEdit) {
        const { error } = await supabase.from('subscriptions').update(payload).eq('id', subscriptionId);
        if (error) throw error;
        toast.success('اشتراک ویرایش شد.');
      } else {
        const { error } = await supabase.from('subscriptions').insert({
          ...payload,
          user_id: user.id,
          status: 'active',
          cancelled_at: null,
          deleted_at: null,
        });
        if (error) throw error;
        toast.success('اشتراک ثبت شد.');
      }
      router.push('/deadlines/subscriptions');
    } catch (error) {
      console.error(error);
      toast.error(isEdit ? 'خطا در ویرایش اشتراک.' : 'خطا در ثبت اشتراک.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-full bg-canvas">
        <TopBar onBack={() => goBack()} title="اشتراک" />
        <div className="space-y-3 px-(--ds-gutter)">
          <Skeleton className="h-12 rounded-control" />
          <Skeleton className="h-12 rounded-control" />
        </div>
      </div>
    );
  }

  const previewInterval =
    Number(form.intervalNumber) > 0
      ? intervalLabel({
          interval_number: Number(form.intervalNumber),
          interval_period: form.intervalPeriod,
        })
      : null;

  const set = <K extends keyof SubscriptionFormState>(k: K, v: SubscriptionFormState[K]) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="min-h-full bg-canvas pb-10">
      <TopBar onBack={() => goBack()} title={isEdit ? 'ویرایش اشتراک' : 'اشتراک جدید'} />
      <form onSubmit={handleSubmit} className="space-y-4 px-(--ds-gutter)">
        <Field label="پلتفرم / سرویس">
          <Input value={form.platform} onChange={(e) => set('platform', e.target.value)} placeholder="مثال: Spotify" required />
        </Field>
        <Field label="کیف پول پیش‌فرض" hint="ارز اشتراک همان ارز این کیف پول است (مثلاً لیر).">
          <PickerField title="کیف پول" options={walletOptions(wallets)} value={form.walletId} onValueChange={(v) => set('walletId', v)} />
        </Field>
        <Field label="مبلغ">
          <AmountField value={form.amount} onValueChange={(v) => set('amount', v)} unitLabel={selectedWallet && selectedWallet.currency !== 'IRT' ? CURRENCY_META[selectedWallet.currency].label : undefined} />
        </Field>
        <Field label="دسته هزینه">
          <PickerField title="دسته هزینه" options={categoryOptions(categories, 'expense')} value={form.categoryId} onValueChange={(v) => set('categoryId', v)} />
        </Field>
        <Field label="سررسید بعدی">
          <DateField value={form.nextDueDate} onValueChange={(v) => set('nextDueDate', v)} quickChips={false} />
        </Field>
        <Field label="هر چند وقت یک بار" hint={previewInterval ? `تکرار: ${previewInterval}` : undefined}>
          <div className="flex gap-2">
            <Input className="w-20" value={form.intervalNumber} onChange={(e) => set('intervalNumber', e.target.value.replace(/[^\d۰-۹]/g, ''))} inputMode="numeric" dir="ltr" aria-label="تعداد" required />
            <SegmentedControl
              aria-label="واحد تکرار"
              className="flex-1"
              value={form.intervalPeriod}
              onValueChange={(v) => set('intervalPeriod', v as LoanIntervalPeriod)}
              options={INTERVAL_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
            />
          </div>
        </Field>
        <Field label="یادآوری تلگرام قبل از سررسید">
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
        <Field label="یادداشت">
          <Textarea value={form.note} onChange={(e) => set('note', e.target.value)} rows={2} placeholder="اختیاری" />
        </Field>
        <Button type="submit" fullWidth size="lg" loading={isSubmitting}>
          {isEdit ? 'ذخیره تغییرات' : 'ثبت اشتراک'}
        </Button>
      </form>
    </div>
  );
}
