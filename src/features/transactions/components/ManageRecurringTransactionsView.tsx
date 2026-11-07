'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, Edit3, Pause, Play, Repeat, Trash2 } from 'lucide-react';
import { BottomSheet } from '@/shared/components/BottomSheet';
import {
  ActionSheet,
  ChoiceChips,
  Field,
  HeaderAction,
  IconBadge,
  ListGroup,
  ListRow,
  Money,
  PageHeader,
  PrimaryButton,
  SegmentedControl,
  SwitchVisual,
  fieldButtonClass,
  fieldInputClass,
} from '@/shared/components/ui';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuth, useData } from '@/features/portfolio/PortfolioProvider';
import { useToast } from '@/shared/components/Toast';
import { useConfirm } from '@/shared/components/ConfirmDialog';
import { FormattedNumberInput } from '@/shared/components/FormattedNumberInput';
import { IOSDatePicker } from '@/shared/components/IOSDatePicker';
import { CategorySheetPicker } from '@/shared/components/CategorySheetPicker';
import { ListSheetPicker } from '@/shared/components/ListSheetPicker';
import type { LoanIntervalPeriod, RecurringTransaction } from '@/shared/types/domain';
import { formatJalaali, formatJalaaliHuman, parseJalaali, todayJalaali } from '@/shared/utils/jalali';
import { formatTelegramMoney } from '@/features/notifications/telegram/utils/format-helpers';
import { intervalLabel } from '@/features/transactions/utils/recurring-transaction-label';
import { CURRENCY_META } from '@/features/wallets/constants/currency-meta';

const INTERVAL_OPTIONS: { id: LoanIntervalPeriod; label: string }[] = [
  { id: 'day', label: 'روز' },
  { id: 'week', label: 'هفته' },
  { id: 'month', label: 'ماه' },
  { id: 'year', label: 'سال' },
];

type FormState = {
  editingId: string | null;
  title: string;
  type: 'INCOME' | 'EXPENSE';
  amountToman: string;
  walletId: string | null;
  categoryId: string | null;
  intervalNumber: string;
  intervalPeriod: LoanIntervalPeriod;
  nextDueDate: string;
  endDate: string;
  note: string;
  isActive: boolean;
};

function emptyForm(): FormState {
  return {
    editingId: null,
    title: '',
    type: 'EXPENSE',
    amountToman: '',
    walletId: null,
    categoryId: null,
    intervalNumber: '1',
    intervalPeriod: 'month',
    nextDueDate: formatJalaali(todayJalaali()),
    endDate: '',
    note: '',
    isActive: true,
  };
}

export function ManageRecurringTransactionsView() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const { user } = useAuth();
  const { wallets, categories } = useData();

  const [rows, setRows] = useState<RecurringTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [nextDueOpen, setNextDueOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const walletItems = useMemo(
    () =>
      wallets.map((wallet) => ({
        id: wallet.id,
        label: wallet.name,
        sublabel: `${CURRENCY_META[wallet.currency].label} · ${wallet.currency}`,
      })),
    [wallets]
  );

  const selectedWallet = wallets.find((wallet) => wallet.id === form.walletId) ?? null;

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('recurring_transactions')
        .select('*')
        .is('deleted_at', null)
        .order('next_due_date_string', { ascending: true });
      if (error) throw error;
      setRows((data ?? []) as RecurringTransaction[]);
    } catch (error) {
      console.error(error);
      toast.error('خطا در دریافت تراکنش‌های دوره‌ای.');
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const [actionRowId, setActionRowId] = useState<string | null>(null);

  const resetForm = () => {
    setForm(emptyForm());
    setFormOpen(false);
  };

  const openCreate = () => {
    setForm(emptyForm());
    setFormOpen(true);
  };

  const openEdit = (row: RecurringTransaction) => {
    setForm({
      editingId: row.id,
      title: row.title,
      type: row.type,
      amountToman: String(row.amount_toman),
      walletId: row.wallet_id,
      categoryId: row.category_id,
      intervalNumber: String(row.interval_number),
      intervalPeriod: row.interval_period,
      nextDueDate: row.next_due_date_string,
      endDate: row.end_date_string ?? '',
      note: row.note ?? '',
      isActive: row.is_active,
    });
    setFormOpen(true);
  };

  const validate = () => {
    if (!form.title.trim()) return 'عنوان الزامی است.';
    if (!form.walletId) return 'کیف پول الزامی است.';
    if (!form.categoryId) return 'دسته الزامی است.';
    if (!parseJalaali(form.nextDueDate)) return 'تاریخ بعدی نامعتبر است.';
    if (form.endDate.trim() && !parseJalaali(form.endDate)) return 'تاریخ پایان نامعتبر است.';
    const amount = Number(form.amountToman);
    if (!Number.isFinite(amount) || amount <= 0) return 'مبلغ نامعتبر است.';
    const intervalNumber = Number(form.intervalNumber);
    if (!Number.isFinite(intervalNumber) || intervalNumber <= 0 || !Number.isInteger(intervalNumber)) {
      return 'فاصله تکرار نامعتبر است.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    const payload = {
      title: form.title.trim(),
      type: form.type,
      amount_toman: Number(form.amountToman),
      wallet_id: form.walletId!,
      category_id: form.categoryId!,
      interval_number: Number(form.intervalNumber),
      interval_period: form.intervalPeriod,
      next_due_date_string: form.nextDueDate,
      end_date_string: form.endDate.trim() || null,
      note: form.note.trim() || null,
      is_active: form.isActive,
      updated_at: new Date().toISOString(),
    };

    setIsSubmitting(true);
    try {
      if (form.editingId) {
        const { error } = await supabase
          .from('recurring_transactions')
          .update(payload)
          .eq('id', form.editingId);
        if (error) throw error;
        toast.success('الگو ویرایش شد.');
      } else {
        const { error } = await supabase.from('recurring_transactions').insert({
          ...payload,
          user_id: user.id,
          deleted_at: null,
        });
        if (error) throw error;
        toast.success('تراکنش دوره‌ای ثبت شد.');
      }
      resetForm();
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error('خطا در ذخیره.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (row: RecurringTransaction) => {
    if (!(await confirm({ message: `«${row.title}» حذف شود؟`, variant: 'danger', confirmLabel: 'حذف' }))) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('recurring_transactions')
        .update({ deleted_at: new Date().toISOString(), is_active: false })
        .eq('id', row.id);
      if (error) throw error;
      toast.success('حذف شد.');
      if (form.editingId === row.id) resetForm();
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error('خطا در حذف.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleActive = async (row: RecurringTransaction) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('recurring_transactions')
        .update({ is_active: !row.is_active, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) throw error;
      await refresh();
    } catch (error) {
      console.error(error);
      toast.error('خطا در تغییر وضعیت.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return null;

  const humanDate = (v: string) => (parseJalaali(v) ? formatJalaaliHuman(parseJalaali(v)!) : v);
  const actionRow = rows.find((r) => r.id === actionRowId) ?? null;

  return (
    <div className="bg-surface-shell min-h-full pb-10 animate-[slide-fade-in-right_300ms_ease-out]">
      <PageHeader
        title="تراکنش‌های دوره‌ای"
        actions={<HeaderAction label="جدید" onClick={openCreate} />}
      />

      <div className="px-4 pt-5 space-y-4">
        <p className="px-1 text-xs leading-relaxed text-zinc-500">
          حقوق، اجاره و … هر روز ساعت ۹ صبح (تهران)، اگر سررسید رسیده باشد، خودکار ثبت می‌شوند.
        </p>

        {isLoading ? (
          <p className="py-8 text-center text-sm text-zinc-500 animate-pulse">در حال دریافت...</p>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm text-zinc-300">هنوز الگویی نساخته‌ای.</p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-3 h-9 rounded-full bg-white/6 px-4 text-sm font-medium text-zinc-100 hover:bg-white/10"
            >
              ساخت الگو
            </button>
          </div>
        ) : (
          <ListGroup>
            {rows.map((row) => {
              const wallet = wallets.find((w) => w.id === row.wallet_id);
              const category = categories.find((c) => c.id === row.category_id);
              const isIncome = row.type === 'INCOME';
              return (
                <ListRow
                  key={row.id}
                  onClick={() => setActionRowId(row.id)}
                  className={row.is_active ? '' : 'opacity-50'}
                  leading={
                    <IconBadge color={category?.color ?? (isIncome ? '#34d399' : '#fb7185')}>
                      <Repeat size={17} strokeWidth={1.9} />
                    </IconBadge>
                  }
                  title={row.title}
                  subtitle={[intervalLabel(row), category?.name, wallet?.name].filter(Boolean).join(' · ')}
                  trailing={
                    <Money tone={isIncome ? 'positive' : 'negative'}>
                      {isIncome ? '+' : '−'}
                      {formatTelegramMoney(Number(row.amount_toman), 'TOMAN')}
                    </Money>
                  }
                  trailingSub={row.is_active ? humanDate(row.next_due_date_string) : 'متوقف'}
                />
              );
            })}
          </ListGroup>
        )}
      </div>

      <ActionSheet
        open={actionRow !== null}
        onClose={() => setActionRowId(null)}
        title={actionRow?.title}
        actions={
          actionRow
            ? [
                { label: 'ویرایش', icon: <Edit3 size={17} />, onSelect: () => openEdit(actionRow) },
                {
                  label: actionRow.is_active ? 'توقف' : 'ادامه',
                  icon: actionRow.is_active ? <Pause size={17} /> : <Play size={17} />,
                  disabled: isSubmitting,
                  onSelect: () => void toggleActive(actionRow),
                },
                {
                  label: 'حذف',
                  icon: <Trash2 size={17} />,
                  tone: 'danger',
                  disabled: isSubmitting,
                  onSelect: () => void handleDelete(actionRow),
                },
              ]
            : []
        }
      />

      <BottomSheet
        open={formOpen}
        onClose={resetForm}
        title={form.editingId ? 'ویرایش الگو' : 'الگوی جدید'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <SegmentedControl
            value={form.type}
            onChange={(type) => setForm((prev) => ({ ...prev, type, categoryId: null }))}
            options={[
              { value: 'EXPENSE', label: 'هزینه' },
              { value: 'INCOME', label: 'درآمد' },
            ]}
          />

          <Field label="عنوان">
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="مثلاً اجاره"
              className={fieldInputClass}
              required
            />
          </Field>

          <Field label="مبلغ (تومان)">
            <FormattedNumberInput
              value={form.amountToman}
              onValueChange={(value) => setForm((prev) => ({ ...prev, amountToman: value }))}
              className={`${fieldInputClass} text-left text-base font-semibold`}
              dir="ltr"
              placeholder="0"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="کیف پول">
              <button type="button" onClick={() => setWalletOpen(true)} className={`${fieldButtonClass} flex items-center justify-between gap-2`}>
                <span className="truncate text-sm text-zinc-100">{selectedWallet?.name ?? 'انتخاب کنید'}</span>
                <ChevronLeft size={15} className="shrink-0 text-zinc-500" />
              </button>
            </Field>
            <Field label="دسته">
              <button type="button" onClick={() => setCategoryOpen(true)} className={`${fieldButtonClass} flex items-center justify-between gap-2`}>
                <span className="truncate text-sm text-zinc-100">
                  {form.categoryId
                    ? categories.find((c) => c.id === form.categoryId)?.name ?? 'انتخاب'
                    : 'انتخاب کنید'}
                </span>
                <ChevronLeft size={15} className="shrink-0 text-zinc-500" />
              </button>
            </Field>
          </div>

          <Field label="تکرار">
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400">هر</span>
              <FormattedNumberInput
                value={form.intervalNumber}
                onValueChange={(value) => setForm((prev) => ({ ...prev, intervalNumber: value }))}
                className={`${fieldInputClass} w-16! text-center`}
                dir="ltr"
              />
              <div className="flex-1">
                <ChoiceChips
                  value={form.intervalPeriod}
                  onChange={(intervalPeriod) =>
                    setForm((prev) => ({ ...prev, intervalPeriod: intervalPeriod as LoanIntervalPeriod }))
                  }
                  options={INTERVAL_OPTIONS.map((opt) => ({ value: opt.id, label: opt.label }))}
                />
              </div>
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="سررسید بعدی">
              <button type="button" onClick={() => setNextDueOpen(true)} className={`${fieldButtonClass} flex items-center gap-2`}>
                <Calendar size={15} className="shrink-0 text-zinc-500" />
                <span className="truncate text-sm text-zinc-100">{humanDate(form.nextDueDate)}</span>
              </button>
            </Field>
            <Field label="پایان">
              <button type="button" onClick={() => setEndDateOpen(true)} className={`${fieldButtonClass} flex items-center gap-2`}>
                <Calendar size={15} className="shrink-0 text-zinc-500" />
                <span className="truncate text-sm text-zinc-100">
                  {form.endDate.trim() ? humanDate(form.endDate) : 'بدون پایان'}
                </span>
              </button>
            </Field>
          </div>

          <Field label="یادداشت">
            <textarea
              value={form.note}
              onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))}
              rows={2}
              placeholder="اختیاری"
              className={`${fieldInputClass} resize-none`}
            />
          </Field>

          <button
            type="button"
            role="switch"
            aria-checked={form.isActive}
            onClick={() => setForm((prev) => ({ ...prev, isActive: !prev.isActive }))}
            className="flex w-full items-center justify-between rounded-xl bg-white/4 px-4 py-3"
          >
            <span className="text-sm text-zinc-200">ثبت خودکار فعال باشد</span>
            <SwitchVisual checked={form.isActive} />
          </button>

          <PrimaryButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'در حال ذخیره...' : form.editingId ? 'ذخیره تغییرات' : 'ثبت الگو'}
          </PrimaryButton>
        </form>
      </BottomSheet>

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

      <CategorySheetPicker
        open={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        title="انتخاب دسته"
        kind={form.type === 'INCOME' ? 'income' : 'expense'}
        categories={categories}
        value={form.categoryId}
        onSelect={(id) => {
          setForm((prev) => ({ ...prev, categoryId: id }));
          setCategoryOpen(false);
        }}
      />

      <IOSDatePicker
        open={nextDueOpen}
        onClose={() => setNextDueOpen(false)}
        value={form.nextDueDate}
        onChange={(value) => setForm((prev) => ({ ...prev, nextDueDate: value }))}
      />
      <IOSDatePicker
        open={endDateOpen}
        onClose={() => setEndDateOpen(false)}
        value={form.endDate || form.nextDueDate}
        onChange={(value) => setForm((prev) => ({ ...prev, endDate: value }))}
      />
    </div>
  );
}
