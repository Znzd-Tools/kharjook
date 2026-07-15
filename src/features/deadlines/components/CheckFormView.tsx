'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Calendar, ChevronLeft } from 'lucide-react';
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
    return <div className="p-6 text-center text-slate-500 animate-pulse">در حال دریافت...</div>;
  }

  const walletItems = wallets.map((wallet) => ({
    id: wallet.id,
    label: `${wallet.name} · ${wallet.currency}`,
  }));

  return (
    <div className="bg-[#0F1015] min-h-full pb-10 animate-[slide-fade-in-up_300ms_ease-out]">
      <div className="sticky top-0 bg-[#161722]/90 backdrop-blur-md px-6 py-4 flex items-center gap-4 border-b border-white/5 z-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 -mr-2 bg-white/5 rounded-full text-slate-300 hover:bg-white/10"
        >
          <ArrowRight size={20} />
        </button>
        <h2 className="text-lg font-bold text-white flex-1">
          {isEdit ? 'ویرایش چک' : 'ثبت چک جدید'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div>
          <label className="block text-xs text-slate-400 mb-1">عنوان / دریافت‌کننده</label>
          <input
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            className="w-full bg-[#1A1B26] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-purple-500 outline-none"
            placeholder="مثال: اجاره دفتر"
            required
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">نام بانک</label>
          <input
            value={form.bankName}
            onChange={(e) => setForm((prev) => ({ ...prev, bankName: e.target.value }))}
            className="w-full bg-[#1A1B26] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-purple-500 outline-none"
            placeholder="اختیاری"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">شماره چک</label>
          <input
            value={form.checkNumber}
            onChange={(e) => setForm((prev) => ({ ...prev, checkNumber: e.target.value }))}
            className="w-full bg-[#1A1B26] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-purple-500 outline-none text-left"
            dir="ltr"
            placeholder="اختیاری"
          />
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">مبلغ چک</label>
          <FormattedNumberInput
            value={form.amount}
            onValueChange={(value) => setForm((prev) => ({ ...prev, amount: value }))}
            className="w-full bg-[#1A1B26] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-purple-500 outline-none text-left"
            dir="ltr"
            required
          />
        </div>

        <button
          type="button"
          onClick={() => setWalletOpen(true)}
          className="w-full bg-[#1A1B26] border border-white/10 rounded-xl p-3 flex items-center justify-between text-right hover:bg-[#222436] transition"
        >
          <div>
            <p className="text-xs text-slate-500">کیف پول (ارز و تسویه پیش‌فرض)</p>
            <p className="text-sm text-slate-100 mt-1">
              {selectedWallet
                ? `${selectedWallet.name} · ${selectedWallet.currency}`
                : 'انتخاب کنید'}
            </p>
          </div>
          <ChevronLeft size={16} className="text-slate-500" />
        </button>

        <button
          type="button"
          onClick={() => setCategoryOpen(true)}
          className="w-full bg-[#1A1B26] border border-white/10 rounded-xl p-3 flex items-center justify-between text-right hover:bg-[#222436] transition"
        >
          <div>
            <p className="text-xs text-slate-500">دسته هزینه</p>
            <p className="text-sm text-slate-100 mt-1">
              {form.categoryId
                ? expenseCategories.find((category) => category.id === form.categoryId)?.name ??
                  'انتخاب کنید'
                : 'انتخاب کنید'}
            </p>
          </div>
          <ChevronLeft size={16} className="text-slate-500" />
        </button>

        <button
          type="button"
          onClick={() => setDueDateOpen(true)}
          className="w-full flex items-center gap-3 bg-[#1A1B26] border border-white/10 rounded-xl p-3 text-right hover:bg-[#222436] transition"
        >
          <Calendar size={16} className="text-purple-400" />
          <div className="flex-1">
            <p className="text-xs text-slate-500">تاریخ سررسید</p>
            <p className="text-sm text-slate-100 mt-1">
              {parseJalaali(form.dueDate)
                ? formatJalaaliHuman(parseJalaali(form.dueDate)!)
                : form.dueDate}
            </p>
          </div>
        </button>

        <div>
          <label className="block text-xs text-slate-400 mb-1">یادداشت</label>
          <textarea
            value={form.note}
            onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
            rows={3}
            className="w-full bg-[#1A1B26] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-purple-500 outline-none resize-none"
            placeholder="اختیاری"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium disabled:opacity-50"
        >
          {isSubmitting ? 'در حال ذخیره...' : isEdit ? 'ذخیره تغییرات' : 'ثبت چک'}
        </button>
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
