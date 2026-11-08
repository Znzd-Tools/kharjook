'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AmountField, Button, Chip, ChipGroup, DateField, Field, Input, PickerField, Skeleton, Textarea, TopBar } from '@/design-system';
import { LOAN_REMINDER_DAY_OPTIONS, normalizeReminderDaysBefore } from '@/features/deadlines/utils/loan-reminder-days';
import { useSafeBack } from '@/shared/hooks/use-safe-back';
import { CURRENCY_META } from '@/features/wallets/constants/currency-meta';
import { categoryOptions, walletOptions } from '@/features/deadlines/v2/form-options';
import { useAuth, useData } from '@/features/portfolio/PortfolioProvider';
import { useToast } from '@/shared/components/Toast';
import { supabase } from '@/shared/lib/supabase/client';
import type { Check, Wallet } from '@/shared/types/domain';
import { formatJalaali, parseJalaali, todayJalaali } from '@/shared/utils/jalali';

type CheckFormState = {
  title: string;
  bankName: string;
  checkNumber: string;
  amount: string;
  walletId: string | null;
  categoryId: string | null;
  dueDate: string;
  note: string;
  reminderDaysBefore: number[];
};

function initialState(): CheckFormState {
  return {
    title: '',
    bankName: '',
    checkNumber: '',
    amount: '',
    walletId: null,
    categoryId: null,
    dueDate: formatJalaali(todayJalaali()),
    note: '',
    reminderDaysBefore: [2],
  };
}

export function CheckFormView({ checkId }: { checkId?: string }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { wallets, categories } = useData();
  const isEdit = !!checkId;

  const [form, setForm] = useState<CheckFormState>(initialState);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const goBack = useSafeBack('/deadlines/checks');

  const selectedWallet = wallets.find((wallet) => wallet.id === form.walletId) ?? null;

  useEffect(() => {
    if (!isEdit || !checkId) return;
    let cancelled = false;
    const run = async () => {
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('checks')
          .select('*')
          .eq('id', checkId)
          .is('deleted_at', null)
          .single();
        if (error) throw error;
        if (cancelled) return;
        const check = data as Check;
        if (check.status !== 'pending') {
          toast.error('فقط چک‌های در انتظار قابل ویرایش هستند.');
          router.replace('/deadlines/checks');
          return;
        }
        setForm({
          title: check.title,
          bankName: check.bank_name ?? '',
          checkNumber: check.check_number ?? '',
          amount: String(check.amount),
          walletId: check.wallet_id,
          categoryId: check.category_id,
          dueDate: check.due_date_string,
          note: check.note ?? '',
          reminderDaysBefore: check.reminder_days_before ?? [2],
        });
      } catch (error) {
        console.error(error);
        toast.error('خطا در دریافت اطلاعات چک.');
        router.back();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [checkId, isEdit, router, toast]);

  const validate = () => {
    if (!form.title.trim()) return 'عنوان الزامی است.';
    if (!parseJalaali(form.dueDate)) return 'تاریخ سررسید نامعتبر است.';
    if (!form.walletId) return 'کیف پول پیش‌فرض تسویه الزامی است.';
    if (!form.categoryId) return 'انتخاب دسته هزینه الزامی است.';
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) return 'مبلغ چک نامعتبر است.';
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

    setIsSubmitting(true);
    try {
      const payload = {
        title: form.title.trim(),
        bank_name: form.bankName.trim() || null,
        check_number: form.checkNumber.trim() || null,
        amount,
        currency: baseWallet.currency,
        due_date_string: form.dueDate,
        wallet_id: form.walletId,
        category_id: form.categoryId,
        note: form.note.trim() || null,
        reminder_days_before: normalizeReminderDaysBefore(form.reminderDaysBefore),
        updated_at: new Date().toISOString(),
      };

      if (isEdit) {
        const { error } = await supabase.from('checks').update(payload).eq('id', checkId);
        if (error) throw error;
        toast.success('چک ویرایش شد.');
      } else {
        const { error } = await supabase.from('checks').insert({
          ...payload,
          user_id: user.id,
          status: 'pending',
          deleted_at: null,
        });
        if (error) throw error;
        toast.success('چک ثبت شد.');
      }
      router.push('/deadlines/checks');
    } catch (error) {
      console.error(error);
      toast.error(isEdit ? 'خطا در ویرایش چک.' : 'خطا در ثبت چک.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-full bg-canvas">
        <TopBar onBack={() => goBack()} title="چک" />
        <div className="space-y-3 px-(--ds-gutter)">
          <Skeleton className="h-12 rounded-control" />
          <Skeleton className="h-12 rounded-control" />
        </div>
      </div>
    );
  }

  const set = <K extends keyof CheckFormState>(k: K, v: CheckFormState[K]) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="min-h-full bg-canvas pb-10">
      <TopBar onBack={() => goBack()} title={isEdit ? 'ویرایش چک' : 'چک جدید'} />
      <form onSubmit={handleSubmit} className="space-y-4 px-(--ds-gutter)">
        <Field label="عنوان / دریافت‌کننده">
          <Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="مثال: اجاره دفتر" required />
        </Field>
        <Field label="مبلغ چک">
          <AmountField value={form.amount} onValueChange={(v) => set('amount', v)} unitLabel={selectedWallet && selectedWallet.currency !== 'IRT' ? CURRENCY_META[selectedWallet.currency].label : undefined} />
        </Field>
        <Field label="تاریخ سررسید">
          <DateField value={form.dueDate} onValueChange={(v) => set('dueDate', v)} quickChips={false} />
        </Field>
        <Field label="کیف پول" hint="ارز چک و کیف پیش‌فرض برای پرداخت.">
          <PickerField title="کیف پول" options={walletOptions(wallets)} value={form.walletId} onValueChange={(v) => set('walletId', v)} />
        </Field>
        <Field label="دسته هزینه">
          <PickerField title="دسته هزینه" options={categoryOptions(categories, 'expense')} value={form.categoryId} onValueChange={(v) => set('categoryId', v)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="نام بانک">
            <Input value={form.bankName} onChange={(e) => set('bankName', e.target.value)} placeholder="اختیاری" />
          </Field>
          <Field label="شماره چک">
            <Input value={form.checkNumber} onChange={(e) => set('checkNumber', e.target.value)} placeholder="اختیاری" dir="ltr" inputMode="numeric" />
          </Field>
        </div>
        <Field label="یادآوری قبل از سررسید (تلگرام و اپ)">
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
          <Textarea value={form.note} onChange={(e) => set('note', e.target.value)} rows={3} placeholder="اختیاری" />
        </Field>
        <Button type="submit" fullWidth size="lg" loading={isSubmitting} disabled={isLoading}>
          {isEdit ? 'ذخیره تغییرات' : 'ثبت چک'}
        </Button>
      </form>
    </div>
  );
}
