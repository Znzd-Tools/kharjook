'use client';

import {
  Field,
  FormSection,
  PageHeader,
  PickerRow,
  PrimaryButton,
  StickyFooter,
  fieldButtonClass,
  fieldInputClass,
} from '@/shared/components/ui';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar } from 'lucide-react';
import { useAuth, useData } from '@/features/portfolio/PortfolioProvider';
import { useToast } from '@/shared/components/Toast';
import { supabase } from '@/shared/lib/supabase/client';
import { FormattedNumberInput } from '@/shared/components/FormattedNumberInput';
import { IOSDatePicker } from '@/shared/components/IOSDatePicker';
import { CategorySheetPicker } from '@/shared/components/CategorySheetPicker';
import { ListSheetPicker } from '@/shared/components/ListSheetPicker';
import type { Check, Wallet } from '@/shared/types/domain';
import { formatJalaali, formatJalaaliHuman, parseJalaali, todayJalaali } from '@/shared/utils/jalali';

type CheckFormState = {
  title: string;
  bankName: string;
  checkNumber: string;
  amount: string;
  walletId: string | null;
  categoryId: string | null;
  dueDate: string;
  note: string;
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
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.kind === 'expense'),
    [categories]
  );
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
    return <div className="p-6 text-center text-zinc-500 animate-pulse">در حال دریافت...</div>;
  }

  const walletItems = wallets.map((wallet) => ({
    id: wallet.id,
    label: `${wallet.name} · ${wallet.currency}`,
  }));

  const dueLabel = parseJalaali(form.dueDate) ? formatJalaaliHuman(parseJalaali(form.dueDate)!) : form.dueDate;
  const categoryName = form.categoryId
    ? expenseCategories.find((category) => category.id === form.categoryId)?.name
    : null;

  return (
    <div className="bg-surface-shell min-h-full animate-[slide-fade-in-up_300ms_ease-out]">
      <PageHeader title={isEdit ? 'ویرایش چک' : 'چک جدید'} />

      <form onSubmit={handleSubmit} className="px-4 pt-5 space-y-6">
        <FormSection title="مبلغ و سررسید">
          <Field label="مبلغ چک">
            <FormattedNumberInput
              value={form.amount}
              onValueChange={(value) => setForm((prev) => ({ ...prev, amount: value }))}
              className={`${fieldInputClass} h-14 text-left text-2xl font-semibold tracking-tight`}
              dir="ltr"
              placeholder="0"
              required
            />
          </Field>
          <Field label="تاریخ سررسید">
            <button type="button" onClick={() => setDueDateOpen(true)} className={`${fieldButtonClass} flex items-center gap-2.5`}>
              <Calendar size={16} className="shrink-0 text-zinc-500" />
              <span className="text-sm text-zinc-100">{dueLabel}</span>
            </button>
          </Field>
        </FormSection>

        <FormSection title="مشخصات چک">
          <Field label="عنوان یا دریافت‌کننده">
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className={fieldInputClass}
              placeholder="مثلاً اجاره دفتر"
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="بانک">
              <input
                value={form.bankName}
                onChange={(e) => setForm((prev) => ({ ...prev, bankName: e.target.value }))}
                className={fieldInputClass}
                placeholder="اختیاری"
              />
            </Field>
            <Field label="شماره چک">
              <input
                value={form.checkNumber}
                onChange={(e) => setForm((prev) => ({ ...prev, checkNumber: e.target.value }))}
                className={`${fieldInputClass} text-left`}
                dir="ltr"
                placeholder="اختیاری"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title="تسویه" description="کیف پول ارز چک را مشخص می‌کند و موقع تسویه پیش‌فرض است.">
          <PickerRow
            label="کیف پول"
            value={selectedWallet ? `${selectedWallet.name} · ${selectedWallet.currency}` : null}
            onClick={() => setWalletOpen(true)}
          />
          <PickerRow label="دسته هزینه" value={categoryName} onClick={() => setCategoryOpen(true)} />
        </FormSection>

        <FormSection title="یادداشت">
          <textarea
            value={form.note}
            onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
            rows={3}
            className={`${fieldInputClass} resize-none`}
            placeholder="اختیاری"
          />
        </FormSection>

        <StickyFooter>
          <PrimaryButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'در حال ذخیره...' : isEdit ? 'ذخیره تغییرات' : 'ثبت چک'}
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
        onSelect={(id) => {
          setForm((prev) => ({ ...prev, categoryId: id }));
          setCategoryOpen(false);
        }}
      />

      <ListSheetPicker
        open={walletOpen}
        onClose={() => setWalletOpen(false)}
        title="انتخاب کیف پول"
        items={walletItems}
        value={form.walletId}
        onSelect={(id) => {
          setForm((prev) => ({ ...prev, walletId: id }));
          setWalletOpen(false);
        }}
      />

      <IOSDatePicker
        open={dueDateOpen}
        onClose={() => setDueDateOpen(false)}
        value={form.dueDate}
        onChange={(value) => setForm((prev) => ({ ...prev, dueDate: value }))}
      />
    </div>
  );
}
