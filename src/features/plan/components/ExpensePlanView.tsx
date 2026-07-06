'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Calculator,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuth, useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { useToast } from '@/shared/components/Toast';
import { FormattedNumberInput } from '@/shared/components/FormattedNumberInput';
import { CategorySheetPicker } from '@/shared/components/CategorySheetPicker';
import type {
  Check,
  ExpensePlanItem,
  ExpensePlanSourceType,
  Loan,
  LoanInstallment,
  RecurringTransaction,
  Subscription,
} from '@/shared/types/domain';
import { formatCurrency } from '@/shared/utils/format-currency';
import { formatJalaali, todayJalaali } from '@/shared/utils/jalali';
import {
  currentPeriod,
  formatPeriodLabel,
  shiftPeriod,
  type Period,
} from '@/shared/utils/period';
import { runOptimisticMutation } from '@/shared/utils/optimistic-mutation';
import {
  buildPlanSuggestions,
  planItemsTotalToman,
  type PlanSuggestion,
} from '@/features/plan/utils/build-plan-suggestions';

type ManualFormState = {
  editingId: string | null;
  title: string;
  amountToman: string;
  note: string;
  categoryId: string | null;
};

const SOURCE_LABELS: Record<Exclude<ExpensePlanSourceType, 'manual'>, string> = {
  installment: 'قسط',
  recurring: 'دوره‌ای',
  check: 'چک',
  subscription: 'اشتراک',
};

function emptyManualForm(): ManualFormState {
  return {
    editingId: null,
    title: '',
    amountToman: '',
    note: '',
    categoryId: null,
  };
}

function toPositiveNumber(value: string): number | null {
  const normalized = value.trim().replace(/,/g, '');
  if (!normalized) return null;
  const n = Number(normalized);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function monthStartString(period: Period): string {
  return formatJalaali(period.start);
}

export function ExpensePlanView() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { categories, currencyRates } = useData();
  const { currencyMode, usdRate } = useUI();

  const [targetPeriod, setTargetPeriod] = useState<Period>(() =>
    shiftPeriod(currentPeriod('month'), 1)
  );
  const [items, setItems] = useState<ExpensePlanItem[]>([]);
  const [installments, setInstallments] = useState<LoanInstallment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [manualForm, setManualForm] = useState<ManualFormState>(emptyManualForm);
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const monthKey = useMemo(() => monthStartString(targetPeriod), [targetPeriod]);
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.kind === 'expense'),
    [categories]
  );
  const categoryById = useMemo(
    () => new Map(expenseCategories.map((c) => [c.id, c])),
    [expenseCategories]
  );

  const refresh = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const [itemsRes, loanRes, installmentRes, checkRes, recurringRes, subscriptionRes] =
        await Promise.all([
        supabase
          .from('expense_plan_items')
          .select('*')
          .eq('month_start_string', monthKey)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase.from('loans').select('*').is('deleted_at', null),
        supabase
          .from('loan_installments')
          .select('*')
          .order('due_date_string', { ascending: true })
          .order('sequence_no', { ascending: true }),
        supabase.from('checks').select('*').is('deleted_at', null),
        supabase
          .from('recurring_transactions')
          .select('*')
          .is('deleted_at', null)
          .eq('is_active', true),
        supabase
          .from('subscriptions')
          .select('*')
          .is('deleted_at', null)
          .eq('status', 'active'),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (loanRes.error) throw loanRes.error;
      if (installmentRes.error) throw installmentRes.error;
      if (checkRes.error) throw checkRes.error;
      if (recurringRes.error) throw recurringRes.error;
      if (subscriptionRes.error) throw subscriptionRes.error;

      setItems((itemsRes.data ?? []) as ExpensePlanItem[]);
      setLoans((loanRes.data ?? []) as Loan[]);
      setInstallments((installmentRes.data ?? []) as LoanInstallment[]);
      setChecks((checkRes.data ?? []) as Check[]);
      setRecurring((recurringRes.data ?? []) as RecurringTransaction[]);
      setSubscriptions((subscriptionRes.data ?? []) as Subscription[]);
    } catch (error) {
      console.error(error);
      toast.error('خطا در دریافت برنامه هزینه.');
    } finally {
      setIsLoading(false);
    }
  }, [monthKey, toast, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const suggestions = useMemo(
    () =>
      buildPlanSuggestions({
        period: targetPeriod,
        items,
        installments,
        loans,
        checks,
        recurring,
        subscriptions,
        currencyRates,
      }),
    [targetPeriod, items, installments, loans, checks, recurring, subscriptions, currencyRates]
  );

  const totalToman = useMemo(() => planItemsTotalToman(items), [items]);

  const displayAmount = useCallback(
    (toman: number) => {
      if (currencyMode === 'USD' && usdRate > 0) {
        return formatCurrency(toman / usdRate, 'USD');
      }
      return formatCurrency(toman, 'TOMAN');
    },
    [currencyMode, usdRate]
  );

  const canSubmitManual = useMemo(() => {
    const title = manualForm.title.trim();
    const amount = toPositiveNumber(manualForm.amountToman);
    return Boolean(title && amount);
  }, [manualForm]);

  const nextSortOrder = useMemo(() => {
    if (items.length === 0) return 0;
    return Math.max(...items.map((item) => item.sort_order)) + 1;
  }, [items]);

  const insertItem = async (payload: {
    title: string;
    amount_toman: number;
    category_id: string | null;
    note: string | null;
    source_type: ExpensePlanSourceType;
    source_id: string | null;
  }) => {
    if (!user) return;
    setIsSubmitting(true);
    const tempId = `temp-plan-${crypto.randomUUID()}`;
    const snapshot = items;
    const optimistic: ExpensePlanItem = {
      id: tempId,
      user_id: user.id,
      month_start_string: monthKey,
      title: payload.title,
      amount_toman: payload.amount_toman,
      category_id: payload.category_id,
      note: payload.note,
      source_type: payload.source_type,
      source_id: payload.source_id,
      sort_order: nextSortOrder,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      await runOptimisticMutation({
        snapshot,
        applyOptimistic: () => {
          setPendingIds((prev) => new Set(prev).add(tempId));
          setItems((prev) => [...prev, optimistic]);
        },
        rollback: (prev) => {
          setPendingIds((p) => {
            const next = new Set(p);
            next.delete(tempId);
            return next;
          });
          setItems(prev);
        },
        commit: async () => {
          const { data, error } = await supabase
            .from('expense_plan_items')
            .insert({
              user_id: user.id,
              month_start_string: monthKey,
              title: payload.title,
              amount_toman: payload.amount_toman,
              category_id: payload.category_id,
              note: payload.note,
              source_type: payload.source_type,
              source_id: payload.source_id,
              sort_order: nextSortOrder,
            })
            .select()
            .single();
          if (error) throw error;
          return data as ExpensePlanItem;
        },
        onSuccess: (saved) => {
          setPendingIds((p) => {
            const next = new Set(p);
            next.delete(tempId);
            return next;
          });
          setItems((prev) => prev.map((row) => (row.id === tempId ? saved : row)));
        },
        onError: () => {
          toast.error('ثبت آیتم برنامه ناموفق بود.');
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !canSubmitManual) return;

    const title = manualForm.title.trim();
    const amount = toPositiveNumber(manualForm.amountToman);
    if (!amount) return;

    const note = manualForm.note.trim() || null;
    const categoryId = manualForm.categoryId;

    if (manualForm.editingId) {
      setIsSubmitting(true);
      const editingId = manualForm.editingId;
      const snapshot = items;
      try {
        await runOptimisticMutation({
          snapshot,
          applyOptimistic: () => {
            setPendingIds((prev) => new Set(prev).add(editingId));
            setItems((prev) =>
              prev.map((row) =>
                row.id === editingId
                  ? { ...row, title, amount_toman: amount, note, category_id: categoryId }
                  : row
              )
            );
          },
          rollback: (prev) => {
            setPendingIds((p) => {
              const next = new Set(p);
              next.delete(editingId);
              return next;
            });
            setItems(prev);
          },
          commit: async () => {
            const { data, error } = await supabase
              .from('expense_plan_items')
              .update({
                title,
                amount_toman: amount,
                note,
                category_id: categoryId,
              })
              .eq('id', editingId)
              .select()
              .single();
            if (error) throw error;
            return data as ExpensePlanItem;
          },
          onSuccess: (saved) => {
            setPendingIds((p) => {
              const next = new Set(p);
              next.delete(editingId);
              return next;
            });
            setItems((prev) => prev.map((row) => (row.id === editingId ? saved : row)));
            setManualForm(emptyManualForm());
            setManualFormOpen(false);
          },
          onError: () => {
            toast.error('ویرایش آیتم ناموفق بود.');
          },
        });
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    await insertItem({
      title,
      amount_toman: amount,
      category_id: categoryId,
      note,
      source_type: 'manual',
      source_id: null,
    });
    setManualForm(emptyManualForm());
    setManualFormOpen(false);
  };

  const handleAddSuggestion = async (suggestion: PlanSuggestion) => {
    await insertItem({
      title: suggestion.title,
      amount_toman: suggestion.amountToman,
      category_id: suggestion.categoryId,
      note: suggestion.note,
      source_type: suggestion.sourceType,
      source_id: suggestion.sourceId,
    });
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    setIsSubmitting(true);
    const snapshot = items;
    try {
      await runOptimisticMutation({
        snapshot,
        applyOptimistic: () => {
          setPendingIds((prev) => new Set(prev).add(id));
          setItems((prev) => prev.filter((row) => row.id !== id));
        },
        rollback: (prev) => {
          setPendingIds((p) => {
            const next = new Set(p);
            next.delete(id);
            return next;
          });
          setItems(prev);
        },
        commit: async () => {
          const { error } = await supabase.from('expense_plan_items').delete().eq('id', id);
          if (error) throw error;
        },
        onSuccess: () => {
          setPendingIds((p) => {
            const next = new Set(p);
            next.delete(id);
            return next;
          });
        },
        onError: () => {
          toast.error('حذف آیتم ناموفق بود.');
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditManual = (item: ExpensePlanItem) => {
    setManualForm({
      editingId: item.id,
      title: item.title,
      amountToman: String(item.amount_toman),
      note: item.note ?? '',
      categoryId: item.category_id,
    });
    setManualFormOpen(true);
  };

  const openNewManual = () => {
    setManualForm(emptyManualForm());
    setManualFormOpen(true);
  };

  const isCurrentMonth =
    targetPeriod.start.jy === todayJalaali().jy &&
    targetPeriod.start.jm === todayJalaali().jm;

  return (
    <div className="px-5 pb-8 space-y-5">
      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white"
          aria-label="بازگشت"
        >
          <ArrowRight size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-white">برنامه هزینه</h1>
          <p className="text-[11px] text-slate-500">پیش‌بینی هزینه‌های ماهانه</p>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
          <Calculator size={18} />
        </div>
      </div>

      <div className="flex items-center justify-between bg-[#1A1B26] border border-white/5 rounded-2xl px-3 py-2">
        <button
          type="button"
          onClick={() => setTargetPeriod((p) => shiftPeriod(p, -1))}
          className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-slate-300 hover:text-white"
          aria-label="ماه قبل"
        >
          <ChevronRight size={18} />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold text-white">{formatPeriodLabel(targetPeriod)}</p>
          <p className="text-[10px] text-slate-500">
            {isCurrentMonth ? 'ماه جاری' : 'ماه هدف'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setTargetPeriod((p) => shiftPeriod(p, 1))}
          className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-slate-300 hover:text-white"
          aria-label="ماه بعد"
        >
          <ChevronLeft size={18} />
        </button>
      </div>

      <section className="bg-linear-to-br from-purple-600/20 to-purple-900/10 border border-purple-500/20 rounded-2xl p-5 text-center space-y-1">
        <p className="text-xs text-purple-200/80">جمع برآورد هزینه</p>
        <p className="text-3xl font-bold text-white" dir="ltr">
          {displayAmount(totalToman)}
        </p>
        <p className="text-[11px] text-slate-400">
          {items.length} آیتم
          {suggestions.length > 0 ? ` · ${suggestions.length} پیشنهاد` : ''}
        </p>
      </section>

      {isLoading ? (
        <div className="flex justify-center py-16 text-slate-400">
          <Loader2 className="animate-spin" size={28} />
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">آیتم‌های برنامه</h2>
              <button
                type="button"
                onClick={openNewManual}
                className="text-xs text-purple-400 hover:text-purple-300 inline-flex items-center gap-1"
              >
                <Plus size={14} />
                افزودن
              </button>
            </div>

            {items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
                هنوز آیتمی اضافه نشده. دستی اضافه کنید یا از پیشنهادها انتخاب کنید.
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item) => {
                  const category = item.category_id
                    ? categoryById.get(item.category_id)
                    : null;
                  const isPending = pendingIds.has(item.id);
                  const sourceLabel =
                    item.source_type !== 'manual'
                      ? SOURCE_LABELS[item.source_type]
                      : null;

                  return (
                    <div
                      key={item.id}
                      className={`rounded-2xl border border-white/5 bg-[#1A1B26] p-4 space-y-2 ${isPending ? 'opacity-60' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (item.source_type === 'manual') openEditManual(item);
                          }}
                          className={`min-w-0 text-right flex-1 ${item.source_type === 'manual' ? 'hover:opacity-90' : ''}`}
                          disabled={item.source_type !== 'manual'}
                        >
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-white truncate">
                              {item.title}
                            </p>
                            {sourceLabel ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 shrink-0">
                                {sourceLabel}
                              </span>
                            ) : null}
                          </div>
                          {item.note ? (
                            <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                              {item.note}
                            </p>
                          ) : null}
                          {category ? (
                            <p className="text-[10px] text-slate-500 mt-1">{category.name}</p>
                          ) : null}
                        </button>
                        <div className="text-left shrink-0 space-y-2">
                          <p className="text-sm font-bold text-rose-300" dir="ltr">
                            {displayAmount(Number(item.amount_toman))}
                          </p>
                          <button
                            type="button"
                            onClick={() => void handleDelete(item.id)}
                            disabled={isSubmitting}
                            className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center hover:bg-rose-500/20"
                            aria-label="حذف"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {suggestions.length > 0 ? (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400" />
                <h2 className="text-sm font-bold text-white">پیشنهادها</h2>
              </div>
              <p className="text-[11px] text-slate-500">
                اقساط باقی‌مانده، چک‌های در انتظار و هزینه‌های دوره‌ای این ماه
              </p>
              <div className="space-y-2">
                {suggestions.map((suggestion) => (
                  <div
                    key={suggestion.key}
                    className="rounded-2xl border border-amber-500/10 bg-amber-500/5 p-4 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white truncate">
                          {suggestion.title}
                        </p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 shrink-0">
                          {SOURCE_LABELS[suggestion.sourceType]}
                        </span>
                      </div>
                      {suggestion.subtitle ? (
                        <p className="text-[11px] text-slate-500 mt-1" dir="ltr">
                          {suggestion.subtitle}
                        </p>
                      ) : null}
                    </div>
                    <div className="shrink-0 text-left space-y-2">
                      <p className="text-sm font-bold text-amber-200" dir="ltr">
                        {displayAmount(suggestion.amountToman)}
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleAddSuggestion(suggestion)}
                        disabled={isSubmitting}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-200 text-xs font-medium hover:bg-amber-500/30"
                      >
                        افزودن
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {manualFormOpen ? (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4">
          <form
            onSubmit={(e) => void handleManualSubmit(e)}
            className="w-full sm:max-w-md bg-[#1A1B26] border border-white/10 rounded-2xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">
                {manualForm.editingId ? 'ویرایش آیتم' : 'آیتم جدید'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setManualFormOpen(false);
                  setManualForm(emptyManualForm());
                }}
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            <label className="block space-y-1.5">
              <span className="text-xs text-slate-400">عنوان</span>
              <input
                value={manualForm.title}
                onChange={(e) => setManualForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-purple-500/50"
                placeholder="مثلاً خرید هفتگی، شهریه کلاس …"
                autoFocus
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs text-slate-400">مبلغ (تومان)</span>
              <FormattedNumberInput
                value={manualForm.amountToman}
                onValueChange={(value) => setManualForm((f) => ({ ...f, amountToman: value }))}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-purple-500/50"
                placeholder="۰"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="text-xs text-slate-400">یادداشت (اختیاری)</span>
              <textarea
                value={manualForm.note}
                onChange={(e) => setManualForm((f) => ({ ...f, note: e.target.value }))}
                rows={2}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-white outline-none focus:border-purple-500/50 resize-none"
                placeholder="توضیح کوتاه …"
              />
            </label>

            <div className="space-y-1.5">
              <span className="text-xs text-slate-400">دسته (اختیاری)</span>
              <button
                type="button"
                onClick={() => setCategoryPickerOpen(true)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 text-sm text-right text-slate-200"
              >
                {manualForm.categoryId
                  ? (categoryById.get(manualForm.categoryId)?.name ?? 'دسته')
                  : 'بدون دسته'}
              </button>
            </div>

            <button
              type="submit"
              disabled={!canSubmitManual || isSubmitting}
              className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-semibold py-3"
            >
              {manualForm.editingId ? 'ذخیره' : 'افزودن به برنامه'}
            </button>
          </form>
        </div>
      ) : null}

      <CategorySheetPicker
        open={categoryPickerOpen}
        onClose={() => setCategoryPickerOpen(false)}
        title="دسته هزینه"
        kind="expense"
        categories={categories}
        value={manualForm.categoryId}
        allowNone
        noneLabel="بدون دسته"
        onSelect={(id) => {
          setManualForm((f) => ({ ...f, categoryId: id }));
          setCategoryPickerOpen(false);
        }}
      />
    </div>
  );
}
