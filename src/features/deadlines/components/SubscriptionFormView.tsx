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
import type { LoanIntervalPeriod, Subscription, Wallet } from '@/shared/types/domain';
import { formatJalaali, formatJalaaliHuman, parseJalaali, todayJalaali } from '@/shared/utils/jalali';
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
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [dueDateOpen, setDueDateOpen] = useState(false);

  const expenseCategories = useMemo(
    () => categories.filter((category) => category.kind === 'expense'),
    [categories]
  );
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
    return <div className="p-6 text-center text-slate-500 animate-pulse">در حال دریافت...</div>;
  }

  const walletItems = wallets.map((wallet) => ({
    id: wallet.id,
    label: `${wallet.name} · ${wallet.currency}`,
  }));

  const previewInterval =
    Number(form.intervalNumber) > 0
      ? intervalLabel({
          interval_number: Number(form.intervalNumber),
          interval_period: form.intervalPeriod,
        })
      : null;

  return (
    <div className="bg-[#0F1015] min-h-full pb-10 animate-in slide-in-from-bottom-8 duration-300">
      <div className="sticky top-0 bg-[#161722]/90 backdrop-blur-md px-6 py-4 flex items-center gap-4 border-b border-white/5 z-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 -mr-2 bg-white/5 rounded-full text-slate-300 hover:bg-white/10"
        >
          <ArrowRight size={20} />
        </button>
        <h2 className="text-lg font-bold text-white flex-1">
          {isEdit ? 'ویرایش اشتراک' : 'ثبت اشتراک جدید'}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">
        <div>
          <label className="block text-xs text-slate-400 mb-1">پلتفرم / سرویس</label>
          <input
            value={form.platform}
            onChange={(e) => setForm((prev) => ({ ...prev, platform: e.target.value }))}
            className="w-full bg-[#1A1B26] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-purple-500 outline-none"
            placeholder="مثال: Netflix"
            required
          />
        </div>

        <button
          type="button"
          onClick={() => setWalletOpen(true)}
          className="w-full bg-[#1A1B26] border border-white/10 rounded-xl p-3 flex items-center justify-between text-right hover:bg-[#222436] transition"
        >
          <div>
            <p className="text-xs text-slate-500">کیف پول پیش‌فرض</p>
            <p className="text-sm text-slate-100 mt-1">
              {selectedWallet
                ? `${selectedWallet.name} · ${selectedWallet.currency}`
                : 'انتخاب کنید'}
            </p>
          </div>
          <ChevronLeft size={16} className="text-slate-500" />
        </button>

        <div>
          <label className="block text-xs text-slate-400 mb-1">مبلغ</label>
          <FormattedNumberInput
            value={form.amount}
            onValueChange={(value) => setForm((prev) => ({ ...prev, amount: value }))}
            className="w-full bg-[#1A1B26] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-purple-500 outline-none text-left"
            dir="ltr"
            required
          />
          {selectedWallet && (
            <p className="text-[11px] text-slate-500 mt-1">ارز: {selectedWallet.currency}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setCategoryOpen(true)}
          className="w-full bg-[#1A1B26] border border-white/10 rounded-xl p-3 flex items-center justify-between text-right hover:bg-[#222436] transition"
        >
          <div>
            <p className="text-xs text-slate-500">دسته هزینه</p>
            <p className="text-sm text-slate-100 mt-1">
              {expenseCategories.find((c) => c.id === form.categoryId)?.name ?? 'انتخاب کنید'}
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
            <p className="text-xs text-slate-500">سررسید بعدی</p>
            <p className="text-sm text-slate-100 mt-1">
              {parseJalaali(form.nextDueDate)
                ? formatJalaaliHuman(parseJalaali(form.nextDueDate)!)
                : form.nextDueDate}
            </p>
          </div>
        </button>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">فاصله تکرار</label>
            <FormattedNumberInput
              value={form.intervalNumber}
              onValueChange={(value) => setForm((prev) => ({ ...prev, intervalNumber: value }))}
              className="w-full bg-[#1A1B26] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-purple-500 outline-none text-left"
              dir="ltr"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">واحد</label>
            <div className="grid grid-cols-2 gap-1 bg-[#1A1B26] p-1 rounded-xl h-[46px]">
              {INTERVAL_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, intervalPeriod: option.id }))}
                  className={`text-[11px] rounded-lg transition ${
                    form.intervalPeriod === option.id
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {previewInterval && (
          <p className="text-[11px] text-slate-500">تکرار: {previewInterval}</p>
        )}

        <div>
          <label className="block text-xs text-slate-400 mb-1">یادآوری تلگرام قبل از سررسید</label>
          <div className="flex flex-wrap gap-2">
            {LOAN_REMINDER_DAY_OPTIONS.map((days) => {
              const active = form.reminderDaysBefore.includes(days);
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      reminderDaysBefore: active
                        ? prev.reminderDaysBefore.filter((d) => d !== days)
                        : normalizeReminderDaysBefore([...prev.reminderDaysBefore, days]),
                    }))
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border ${
                    active
                      ? 'bg-purple-600/25 border-purple-500/50 text-purple-200'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200'
                  }`}
                >
                  {days} روز قبل
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1">یادداشت</label>
          <textarea
            value={form.note}
            onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
            rows={2}
            className="w-full bg-[#1A1B26] border border-white/10 rounded-xl p-3 text-sm text-white focus:border-purple-500 outline-none resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition disabled:opacity-50"
        >
          {isSubmitting ? 'در حال ذخیره...' : isEdit ? 'ذخیره تغییرات' : 'ثبت اشتراک'}
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
        value={form.nextDueDate}
        onChange={(value) => setForm((prev) => ({ ...prev, nextDueDate: value }))}
      />
    </div>
  );
}
