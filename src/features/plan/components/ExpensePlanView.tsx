'use client';

import { BottomSheet } from '@/shared/components/BottomSheet';
import {
  ActionSheet,
  Card,
  Field,
  IconBadge,
  ListGroup,
  ListRow,
  Money,
  PageHeader,
  PickerRow,
  PrimaryButton,
  Section,
  Stat,
  fieldInputClass,
} from '@/shared/components/ui';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calculator,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuth, useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { useToast } from '@/shared/components/Toast';
import { FormattedNumberInput } from '@/shared/components/FormattedNumberInput';
import { CategorySheetPicker } from '@/shared/components/CategorySheetPicker';
import type {
  CategorySpendingCap,
  Check,
  ExpensePlanItem,
  ExpensePlanSourceType,
  Loan,
  LoanInstallment,
  RecurringTransaction,
  Subscription,
} from '@/shared/types/domain';
import { sumCategoryCapsToman } from '@/features/categories/utils/category-spending-caps';
import { formatCurrency } from '@/shared/utils/format-currency';
import { formatJalaali, todayJalaali } from '@/shared/utils/jalali';
import {
  currentPeriod,
  formatPeriodLabel,
  shiftPeriod,
  type Period,
} from '@/shared/utils/period';
import { rollupCategories } from '@/features/reports/utils/category-rollup';
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

/** Suggestions shown before "show all"; the full list can be long (every installment). */
const SUGGESTION_PREVIEW = 5;

export function ExpensePlanView() {
  const toast = useToast();
  const { user } = useAuth();
  const { assets, categories, currencyRates, transactions, wallets } = useData();
  const { currencyMode, usdRate } = useUI();

  const [targetPeriod, setTargetPeriod] = useState<Period>(() =>
    shiftPeriod(currentPeriod('month'), 1)
  );
  const [actionItemId, setActionItemId] = useState<string | null>(null);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [items, setItems] = useState<ExpensePlanItem[]>([]);
  const [installments, setInstallments] = useState<LoanInstallment[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [checks, setChecks] = useState<Check[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [spendingCaps, setSpendingCaps] = useState<CategorySpendingCap[]>([]);
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
      const [
        itemsRes,
        loanRes,
        installmentRes,
        checkRes,
        recurringRes,
        subscriptionRes,
        capsRes,
      ] = await Promise.all([
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
        supabase.from('category_spending_caps').select('*'),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (loanRes.error) throw loanRes.error;
      if (installmentRes.error) throw installmentRes.error;
      if (checkRes.error) throw checkRes.error;
      if (recurringRes.error) throw recurringRes.error;
      if (subscriptionRes.error) throw subscriptionRes.error;
      if (capsRes.error) throw capsRes.error;

      setItems((itemsRes.data ?? []) as ExpensePlanItem[]);
      setLoans((loanRes.data ?? []) as Loan[]);
      setInstallments((installmentRes.data ?? []) as LoanInstallment[]);
      setChecks((checkRes.data ?? []) as Check[]);
      setRecurring((recurringRes.data ?? []) as RecurringTransaction[]);
      setSubscriptions((subscriptionRes.data ?? []) as Subscription[]);
      setSpendingCaps((capsRes.data ?? []) as CategorySpendingCap[]);
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
        assets,
      }),
    [
      targetPeriod,
      items,
      installments,
      loans,
      checks,
      recurring,
      subscriptions,
      currencyRates,
      assets,
    ]
  );

  const totalToman = useMemo(() => planItemsTotalToman(items), [items]);
  const todayStr = useMemo(() => formatJalaali(todayJalaali()), []);
  const canCompareActual = monthKey <= todayStr;
  const actualExpenseToman = useMemo(() => {
    if (!canCompareActual) return null;
    const rollup = rollupCategories({
      transactions,
      categories,
      wallets,
      period: targetPeriod,
      kind: 'expense',
      walletId: null,
      currencyMode: 'TOMAN',
    });
    return rollup.total;
  }, [canCompareActual, transactions, categories, wallets, targetPeriod]);
  const varianceToman =
    actualExpenseToman != null ? totalToman - actualExpenseToman : null;
  const capsTotalToman = useMemo(
    () => sumCategoryCapsToman(spendingCaps, categories, 'expense'),
    [spendingCaps, categories]
  );

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

  const actionItem = items.find((i) => i.id === actionItemId) ?? null;
  const closeManual = () => {
    setManualFormOpen(false);
    setManualForm(emptyManualForm());
  };
  const navBtn =
    'inline-flex h-9 w-9 items-center justify-center rounded-full text-zinc-400 hover:bg-white/6 hover:text-zinc-100';

  return (
    <div className="bg-surface-shell min-h-full pb-10 animate-[slide-fade-in-right_300ms_ease-out]">
      <PageHeader title="برنامه هزینه" subtitle="پیش‌بینی هزینه‌های ماه" />

      <div className="px-4 pt-5 space-y-7">
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3 px-1">
            <div className="min-w-0">
              <p className="text-xs text-zinc-500">
                برآورد هزینهٔ {formatPeriodLabel(targetPeriod)}
                {isCurrentMonth ? ' · ماه جاری' : ''}
              </p>
              <p className="mt-1 text-[1.75rem] leading-tight font-semibold tracking-tight text-zinc-50">
                <Money>{displayAmount(totalToman)}</Money>
              </p>
            </div>
            <div className="flex shrink-0 items-center">
              <button type="button" onClick={() => setTargetPeriod((p) => shiftPeriod(p, -1))} className={navBtn} aria-label="ماه قبل">
                <ChevronRight size={17} />
              </button>
              <button type="button" onClick={() => setTargetPeriod((p) => shiftPeriod(p, 1))} className={navBtn} aria-label="ماه بعد">
                <ChevronLeft size={17} />
              </button>
            </div>
          </div>
          {(capsTotalToman > 0 || actualExpenseToman != null) && (
            <Card className="grid grid-cols-3 gap-3">
              <Stat label="سقف دسته‌ها" value={capsTotalToman > 0 ? displayAmount(capsTotalToman) : '—'} />
              <Stat label="هزینهٔ واقعی" value={actualExpenseToman != null ? displayAmount(actualExpenseToman) : '—'} />
              <Stat
                label="اختلاف"
                value={actualExpenseToman != null ? displayAmount(varianceToman ?? 0) : '—'}
                tone={actualExpenseToman == null ? 'neutral' : (varianceToman ?? 0) >= 0 ? 'positive' : 'negative'}
                hint="برنامه − واقعی"
              />
            </Card>
          )}
        </section>

        {isLoading ? (
          <div className="flex justify-center py-16 text-zinc-400">
            <Loader2 className="animate-spin" size={26} />
          </div>
        ) : (
          <>
            <Section
              title="آیتم‌های برنامه"
              description={items.length > 0 ? `${items.length.toLocaleString('fa-IR')} آیتم` : undefined}
              action={{ label: 'افزودن', onClick: openNewManual }}
            >
              {items.length === 0 ? (
                <Card>
                  <p className="text-center text-sm leading-relaxed text-zinc-500">
                    هنوز آیتمی نیست. دستی اضافه کن یا از پیشنهادهای پایین انتخاب کن.
                  </p>
                </Card>
              ) : (
                <ListGroup>
                  {items.map((item) => {
                    const category = item.category_id ? categoryById.get(item.category_id) : null;
                    const sourceLabel = item.source_type !== 'manual' ? SOURCE_LABELS[item.source_type] : null;
                    return (
                      <ListRow
                        key={item.id}
                        onClick={() => setActionItemId(item.id)}
                        className={pendingIds.has(item.id) ? 'opacity-50' : ''}
                        leading={
                          <IconBadge color={category?.color}>
                            <Calculator size={16} strokeWidth={1.9} />
                          </IconBadge>
                        }
                        title={item.title}
                        subtitle={[sourceLabel, category?.name, item.note].filter(Boolean).join(' · ') || undefined}
                        trailing={<Money>{displayAmount(Number(item.amount_toman))}</Money>}
                      />
                    );
                  })}
                </ListGroup>
              )}
            </Section>

            {suggestions.length > 0 && (
              <Section
                title={
                  <span className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-400" />
                    پیشنهادها
                  </span>
                }
                description="اقساط مانده، چک‌های در انتظار و هزینه‌های دوره‌ای این ماه"
              >
                <ListGroup>
                  {(showAllSuggestions ? suggestions : suggestions.slice(0, SUGGESTION_PREVIEW)).map((suggestion) => (
                    <div key={suggestion.key} className="flex items-center gap-3 px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void handleAddSuggestion(suggestion)}
                        disabled={isSubmitting}
                        aria-label={`افزودن ${suggestion.title}`}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/6 text-zinc-200 hover:bg-white/10 disabled:opacity-40"
                      >
                        <Plus size={17} />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-zinc-100">{suggestion.title}</p>
                        <p className="mt-0.5 truncate text-xs text-zinc-500">
                          {SOURCE_LABELS[suggestion.sourceType]}
                          {suggestion.subtitle ? <span dir="ltr"> · {suggestion.subtitle}</span> : null}
                        </p>
                      </div>
                      <Money className="shrink-0 text-sm font-semibold text-zinc-300">
                        {displayAmount(suggestion.amountToman)}
                      </Money>
                    </div>
                  ))}
                </ListGroup>
                {suggestions.length > SUGGESTION_PREVIEW && (
                  <button
                    type="button"
                    onClick={() => setShowAllSuggestions((v) => !v)}
                    className="h-10 w-full rounded-xl bg-white/5 text-sm font-medium text-zinc-300 hover:bg-white/8"
                  >
                    {showAllSuggestions
                      ? 'نمایش کمتر'
                      : `نمایش همه (${suggestions.length.toLocaleString('fa-IR')})`}
                  </button>
                )}
              </Section>
            )}
          </>
        )}
      </div>

      <ActionSheet
        open={actionItem !== null}
        onClose={() => setActionItemId(null)}
        title={actionItem?.title}
        actions={
          actionItem
            ? [
                ...(actionItem.source_type === 'manual'
                  ? [{ label: 'ویرایش', icon: <Edit3 size={17} />, onSelect: () => openEditManual(actionItem) }]
                  : []),
                {
                  label: 'حذف از برنامه',
                  icon: <Trash2 size={17} />,
                  tone: 'danger' as const,
                  disabled: isSubmitting,
                  onSelect: () => void handleDelete(actionItem.id),
                },
              ]
            : []
        }
      />

      <BottomSheet open={manualFormOpen} onClose={closeManual} title={manualForm.editingId ? 'ویرایش آیتم' : 'آیتم جدید'}>
        <form onSubmit={(e) => void handleManualSubmit(e)} className="space-y-4">
          <Field label="عنوان">
            <input
              value={manualForm.title}
              onChange={(e) => setManualForm((f) => ({ ...f, title: e.target.value }))}
              className={fieldInputClass}
              placeholder="مثلاً خرید هفتگی یا شهریه"
              data-autofocus
            />
          </Field>
          <Field label="مبلغ (تومان)">
            <FormattedNumberInput
              value={manualForm.amountToman}
              onValueChange={(value) => setManualForm((f) => ({ ...f, amountToman: value }))}
              className={`${fieldInputClass} text-left text-lg font-semibold`}
              dir="ltr"
              placeholder="0"
            />
          </Field>
          <PickerRow
            label="دسته"
            value={manualForm.categoryId ? categoryById.get(manualForm.categoryId)?.name : null}
            placeholder="بدون دسته"
            onClick={() => setCategoryPickerOpen(true)}
          />
          <Field label="یادداشت">
            <textarea
              value={manualForm.note}
              onChange={(e) => setManualForm((f) => ({ ...f, note: e.target.value }))}
              rows={2}
              className={`${fieldInputClass} resize-none`}
              placeholder="اختیاری"
            />
          </Field>
          <PrimaryButton type="submit" disabled={!canSubmitManual || isSubmitting}>
            {manualForm.editingId ? 'ذخیره' : 'افزودن به برنامه'}
          </PrimaryButton>
        </form>
      </BottomSheet>

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
