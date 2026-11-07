'use client';

import { BottomSheet } from '@/shared/components/BottomSheet';
import { EmptyState } from '@/shared/components/EmptyState';
import {
  ActionSheet,
  Card,
  Field,
  HeaderAction,
  IconBadge,
  ListGroup,
  Money,
  PageHeader,
  PickerRow,
  PrimaryButton,
  ProgressBar,
  SegmentedControl,
  Section,
  fieldInputClass,
} from '@/shared/components/ui';
import { useMemo, useState } from 'react';
import {
  Activity,
  Edit3,
  MoreHorizontal,
  Folder,
  TargetIcon,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/shared/lib/supabase/client';
import type { Goal, GoalScope, GoalTargetKind } from '@/shared/types/domain';
import { useAuth, useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { FormattedNumberInput } from '@/shared/components/FormattedNumberInput';
import {
  ListSheetPicker,
  type ListSheetPickerItem,
} from '@/shared/components/ListSheetPicker';
import { CategorySheetPicker } from '@/shared/components/CategorySheetPicker';
import { useToast } from '@/shared/components/Toast';
import { useConfirm } from '@/shared/components/ConfirmDialog';
import { runOptimisticMutation } from '@/shared/utils/optimistic-mutation';
import {
  buildAssetSnapshots,
  calculateAssetGoalProgress,
  calculateGroupGoalProgress,
  totalSnapshotValueToman,
  type GoalProgress,
} from '@/features/goals/utils/goal-progress';
import { GoalProgressDisplay } from '@/features/goals/components/GoalProgressDisplay';
import { goalValueKindFromGoal } from '@/features/goals/utils/goal-progress-display';

type FormState = {
  editingId: string | null;
  scope: GoalScope;
  assetId: string;
  categoryId: string;
  targetKind: GoalTargetKind;
  targetValue: string;
};

const emptyForm: FormState = {
  editingId: null,
  scope: 'asset',
  assetId: '',
  categoryId: '',
  targetKind: 'allocation_percent',
  targetValue: '',
};

function toPositiveNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function makeGoalPayload(userId: string, form: FormState) {
  const target = toPositiveNumber(form.targetValue);
  const targetKind = form.scope === 'asset_group' ? 'allocation_percent' : form.targetKind;
  return {
    user_id: userId,
    scope: form.scope,
    asset_id: form.scope === 'asset' ? form.assetId : null,
    category_id: form.scope === 'asset_group' ? form.categoryId : null,
    target_kind: targetKind,
    target_quantity: targetKind === 'quantity' ? target : null,
    target_percent: targetKind === 'allocation_percent' ? target : null,
  };
}

export function ManageGoalsView() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const { user } = useAuth();
  const { assets, categories, transactions, goals, setGoals } = useData();
  const { currencyMode, usdRate } = useUI();

  const [form, setForm] = useState<FormState>(emptyForm);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionGoalId, setActionGoalId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [pendingGoalIds, setPendingGoalIds] = useState<Set<string>>(new Set());

  const assetItems = useMemo<ListSheetPickerItem[]>(
    () =>
      assets.map((asset) => ({
        id: asset.id,
        label: asset.name,
        sublabel: asset.unit,
        leading: <Activity size={14} />,
      })),
    [assets]
  );

  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets]);
  const categoryById = useMemo(
    () => new Map(categories.filter((c) => c.kind === 'asset').map((c) => [c.id, c])),
    [categories]
  );

  const snapshots = useMemo(
    () => buildAssetSnapshots(assets, transactions, currencyMode, usdRate),
    [assets, transactions, currencyMode, usdRate]
  );
  const totalValueToman = useMemo(() => totalSnapshotValueToman(snapshots), [snapshots]);

  const sortedGoals = useMemo(() => {
    return [...goals].sort((a, b) => {
      if (a.scope !== b.scope) return a.scope === 'asset_group' ? -1 : 1;
      return (a.created_at ?? '').localeCompare(b.created_at ?? '');
    });
  }, [goals]);

  const userId = user?.id ?? '';
  const selectedAsset = form.assetId ? assetById.get(form.assetId) ?? null : null;
  const selectedCategory = form.categoryId ? categoryById.get(form.categoryId) ?? null : null;
  const effectiveTargetKind =
    form.scope === 'asset_group' ? 'allocation_percent' : form.targetKind;
  const targetNumber = toPositiveNumber(form.targetValue);
  const percentInvalid =
    effectiveTargetKind === 'allocation_percent' && (targetNumber <= 0 || targetNumber > 100);
  const quantityInvalid = effectiveTargetKind === 'quantity' && targetNumber <= 0;
  const targetInvalid = percentInvalid || quantityInvalid;
  const targetMissing = form.scope === 'asset' ? !form.assetId : !form.categoryId;
  const budgetValidation = useMemo(() => {
    const nextGoals = goals.filter((goal) => goal.id !== form.editingId);
    const shouldIncludeDraft =
      !!userId &&
      !targetMissing &&
      !targetInvalid &&
      effectiveTargetKind === 'allocation_percent';
    if (shouldIncludeDraft) {
      nextGoals.push({
        id: form.editingId ?? '__draft__',
        user_id: userId,
        scope: form.scope,
        asset_id: form.scope === 'asset' ? form.assetId : null,
        category_id: form.scope === 'asset_group' ? form.categoryId : null,
        target_kind: 'allocation_percent',
        target_quantity: null,
        target_percent: targetNumber,
        created_at: undefined,
        updated_at: undefined,
      });
    }

    const parentGoals = nextGoals.filter(
      (goal) => goal.scope === 'asset_group' && goal.target_kind === 'allocation_percent'
    );
    const childGoals = nextGoals.filter(
      (goal) => goal.scope === 'asset' && goal.target_kind === 'allocation_percent'
    );

    const parentSum = parentGoals.reduce(
      (sum, goal) => sum + Number(goal.target_percent ?? 0),
      0
    );
    const childSum = childGoals.reduce(
      (sum, goal) => sum + Number(goal.target_percent ?? 0),
      0
    );

    const childSumByCategory = new Map<string, number>();
    childGoals.forEach((goal) => {
      const categoryId = goal.asset_id ? assetById.get(goal.asset_id)?.category_id : null;
      if (!categoryId) return;
      childSumByCategory.set(
        categoryId,
        (childSumByCategory.get(categoryId) ?? 0) + Number(goal.target_percent ?? 0)
      );
    });

    const parentByCategory = new Map<string, number>();
    parentGoals.forEach((goal) => {
      if (!goal.category_id) return;
      parentByCategory.set(goal.category_id, Number(goal.target_percent ?? 0));
    });

    const issues: string[] = [];
    if (parentSum > 100.0001) {
      issues.push(
        `جمع درصد هدف‌های گروهی ${parentSum.toFixed(1)}% است و نباید از 100% بیشتر شود.`
      );
    }
    if (childSum > 100.0001) {
      issues.push(
        `جمع درصد هدف‌های دارایی ${childSum.toFixed(1)}% است و نباید از 100% بیشتر شود.`
      );
    }
    childSumByCategory.forEach((sum, categoryId) => {
      const parentTarget = parentByCategory.get(categoryId);
      if (parentTarget == null) return;
      if (sum > parentTarget + 0.0001) {
        const categoryName = categoryById.get(categoryId)?.name ?? 'گروه';
        issues.push(
          `در گروه «${categoryName}»، مجموع درصد فرزندها ${sum.toFixed(1)}% از هدف گروه (${parentTarget.toFixed(1)}%) بیشتر است.`
        );
      }
    });

    return {
      blocking: issues.length > 0,
      issues,
      parentSum,
      childSum,
      categoryRows: Array.from(
        new Set([...childSumByCategory.keys(), ...parentByCategory.keys()])
      )
        .map((categoryId) => {
          const parentTarget = parentByCategory.get(categoryId) ?? null;
          const childrenSum = childSumByCategory.get(categoryId) ?? 0;
          const categoryName = categoryById.get(categoryId)?.name ?? 'گروه';
          return {
            categoryId,
            categoryName,
            parentTarget,
            childrenSum,
            remainingToParent:
              parentTarget == null ? null : Math.max(0, parentTarget - childrenSum),
          };
        })
        .sort((a, b) => {
          const aTarget = a.parentTarget ?? -1;
          const bTarget = b.parentTarget ?? -1;
          return bTarget - aTarget;
        }),
    };
  }, [
    goals,
    form,
    targetMissing,
    targetInvalid,
    effectiveTargetKind,
    targetNumber,
    userId,
    assetById,
    categoryById,
  ]);

  const canSubmit =
    !isSubmitting &&
    !targetMissing &&
    !targetInvalid &&
    !budgetValidation.blocking;

  const switchScope = (scope: GoalScope) => {
    setForm({
      ...emptyForm,
      scope,
      targetKind: scope === 'asset_group' ? 'allocation_percent' : 'allocation_percent',
    });
  };

  const resetForm = () => {
    setForm(emptyForm);
    setSheetOpen(false);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setSheetOpen(true);
  };

  const duplicateGoal = () => {
    const targetKind = effectiveTargetKind;
    return goals.find((goal) => {
      if (goal.id === form.editingId) return false;
      if (goal.scope !== form.scope || goal.target_kind !== targetKind) return false;
      if (form.scope === 'asset') return goal.asset_id === form.assetId;
      return goal.category_id === form.categoryId;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!canSubmit) return;
    if (budgetValidation.blocking) {
      toast.error(budgetValidation.issues[0] ?? 'ترکیب هدف‌ها معتبر نیست.');
      return;
    }
    if (duplicateGoal()) {
      toast.error('برای این مورد قبلا هدفی با همین نوع ثبت شده است.');
      return;
    }

    const execute = async () => {
      const payload = makeGoalPayload(user.id, form);
      if (form.editingId) {
        const editingId = form.editingId;
        const snapshot = goals;
        await runOptimisticMutation({
          snapshot,
          applyOptimistic: () => {
            setPendingGoalIds((prev) => new Set(prev).add(editingId));
            setGoals((prev) =>
              prev.map((goal) => (goal.id === editingId ? { ...goal, ...payload } : goal))
            );
          },
          rollback: (prev) => {
            setPendingGoalIds((p) => {
              const next = new Set(p);
              next.delete(editingId);
              return next;
            });
            setGoals(prev);
          },
          commit: async () => {
            const { data, error } = await supabase
              .from('goals')
              .update(payload)
              .eq('id', editingId)
              .select()
              .single();
            if (error) throw error;
            return data as Goal;
          },
          onSuccess: (saved) => {
            setPendingGoalIds((p) => {
              const next = new Set(p);
              next.delete(editingId);
              return next;
            });
            setGoals((prev) => prev.map((goal) => (goal.id === editingId ? saved : goal)));
          },
        });
      } else {
        const tempId = `temp-goal-${crypto.randomUUID()}`;
        const snapshot = goals;
        const optimisticGoal: Goal = {
          id: tempId,
          ...payload,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await runOptimisticMutation({
          snapshot,
          applyOptimistic: () => {
            setPendingGoalIds((prev) => new Set(prev).add(tempId));
            setGoals((prev) => [...prev, optimisticGoal]);
          },
          rollback: (prev) => {
            setPendingGoalIds((p) => {
              const next = new Set(p);
              next.delete(tempId);
              return next;
            });
            setGoals(prev);
          },
          commit: async () => {
            const { data, error } = await supabase
              .from('goals')
              .insert([payload])
              .select()
              .single();
            if (error) throw error;
            return data as Goal;
          },
          onSuccess: (saved) => {
            setPendingGoalIds((p) => {
              const next = new Set(p);
              next.delete(tempId);
              return next;
            });
            setGoals((prev) => prev.map((goal) => (goal.id === tempId ? saved : goal)));
          },
        });
      }
      resetForm();
    };

    setIsSubmitting(true);
    try {
      await execute();
    } catch (error) {
      console.error(error);
      toast.error('ذخیره هدف ناموفق بود.', {
        action: { label: 'تلاش مجدد', onClick: () => void execute() },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (goal: Goal) => {
    setForm({
      editingId: goal.id,
      scope: goal.scope,
      assetId: goal.asset_id ?? '',
      categoryId: goal.category_id ?? '',
      targetKind: goal.target_kind,
      targetValue: String(goal.target_quantity ?? goal.target_percent ?? ''),
    });
    setSheetOpen(true);
  };

  const handleDelete = async (goal: Goal) => {
    if (!user) return;
    if (!(await confirm({ message: 'این هدف حذف شود؟', variant: 'danger', confirmLabel: 'حذف' }))) return;
    const execute = async () => {
      const snapshot = goals;
      await runOptimisticMutation({
        snapshot,
        applyOptimistic: () => {
          setPendingGoalIds((prev) => new Set(prev).add(goal.id));
          setGoals((prev) => prev.filter((row) => row.id !== goal.id));
        },
        rollback: (prev) => {
          setPendingGoalIds((p) => {
            const next = new Set(p);
            next.delete(goal.id);
            return next;
          });
          setGoals(prev);
        },
        commit: async () => {
          const { error } = await supabase.from('goals').delete().eq('id', goal.id);
          if (error) throw error;
        },
        onSuccess: () => {
          setPendingGoalIds((p) => {
            const next = new Set(p);
            next.delete(goal.id);
            return next;
          });
        },
      });
      if (form.editingId === goal.id) resetForm();
    };

    try {
      await execute();
    } catch {
      toast.error('حذف هدف ناموفق بود.', {
        action: { label: 'تلاش مجدد', onClick: () => void execute() },
      });
    }
  };

  if (!user) return null;

  const actionGoal = goals.find((g) => g.id === actionGoalId) ?? null;
  const goalName = (goal: Goal) =>
    goal.scope === 'asset'
      ? (goal.asset_id ? assetById.get(goal.asset_id)?.name : undefined) ?? 'دارایی حذف‌شده'
      : (goal.category_id ? categoryById.get(goal.category_id)?.name : undefined) ?? 'گروه حذف‌شده';

  const budgetSummary = (
    <div className="space-y-3">
      <BudgetProgressRow
        label="هدف‌های گروهی"
        used={budgetValidation.parentSum}
        total={100}
        tone={budgetValidation.parentSum > 100 ? 'danger' : 'normal'}
      />
      <BudgetProgressRow
        label="هدف‌های دارایی"
        used={budgetValidation.childSum}
        total={100}
        tone={budgetValidation.childSum > 100 ? 'danger' : 'normal'}
      />
    </div>
  );

  return (
    <div className="bg-surface-shell min-h-full pb-10 animate-[slide-fade-in-right_300ms_ease-out]">
      <PageHeader title="اهداف تخصیص" actions={<HeaderAction label="هدف جدید" onClick={openCreate} />} />

      <div className="px-4 pt-5 space-y-7">
        <Section title="بودجه درصدی" description="جمع درصدها نباید از ۱۰۰ بیشتر شود.">
          <Card className="space-y-4">
            {budgetSummary}
            {budgetValidation.categoryRows.length > 0 && (
              <div className="space-y-2.5 border-t border-white/5 pt-4">
                <p className="text-xs text-zinc-500">سهم دارایی‌ها از هدف هر گروه</p>
                {budgetValidation.categoryRows.slice(0, 6).map((row) => (
                  <div key={row.categoryId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate text-zinc-300">{row.categoryName}</span>
                      {row.parentTarget == null ? (
                        <span className="text-amber-300">هدف گروه ندارد</span>
                      ) : (
                        <span dir="ltr" className={row.childrenSum > row.parentTarget ? 'text-rose-300' : 'text-zinc-400'}>
                          {row.childrenSum.toFixed(1)} / {row.parentTarget.toFixed(1)}%
                        </span>
                      )}
                    </div>
                    {row.parentTarget != null && (
                      <ProgressBar
                        value={row.childrenSum}
                        max={row.parentTarget || 1}
                        tone={row.childrenSum > row.parentTarget ? 'negative' : 'accent'}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Section>

        <Section title="هدف‌ها" description={goals.length > 0 ? `${goals.length.toLocaleString('fa-IR')} هدف فعال` : undefined}>
          {sortedGoals.length === 0 ? (
            <EmptyState
              icon={<TargetIcon size={22} />}
              title="هنوز هدفی نگذاشته‌ای."
              description="برای یک دارایی یا گروه درصد سبد یا مقدار هدف بگذار."
              actionLabel="تعریف هدف"
              onAction={openCreate}
            />
          ) : (
            <ListGroup>
              {sortedGoals.map((goal) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  name={goalName(goal)}
                  assetUnit={goal.asset_id ? assetById.get(goal.asset_id)?.unit : undefined}
                  pending={pendingGoalIds.has(goal.id)}
                  progress={
                    goal.scope === 'asset'
                      ? calculateAssetGoalProgress(goal, snapshots, totalValueToman)
                      : calculateGroupGoalProgress(goal, snapshots, totalValueToman)
                  }
                  onOpen={() => handleEdit(goal)}
                  onMore={() => setActionGoalId(goal.id)}
                />
              ))}
            </ListGroup>
          )}
        </Section>
      </div>

      <ActionSheet
        open={actionGoal !== null}
        onClose={() => setActionGoalId(null)}
        title={actionGoal ? goalName(actionGoal) : undefined}
        actions={
          actionGoal
            ? [
                { label: 'ویرایش', icon: <Edit3 size={17} />, onSelect: () => handleEdit(actionGoal) },
                {
                  label: 'حذف',
                  icon: <Trash2 size={17} />,
                  tone: 'danger',
                  disabled: pendingGoalIds.has(actionGoal.id),
                  onSelect: () => void handleDelete(actionGoal),
                },
              ]
            : []
        }
      />

      <BottomSheet open={sheetOpen} onClose={resetForm} title={form.editingId ? 'ویرایش هدف' : 'هدف جدید'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <SegmentedControl
            value={form.scope}
            onChange={switchScope}
            options={[
              { value: 'asset', label: 'یک دارایی' },
              { value: 'asset_group', label: 'یک گروه' },
            ]}
          />
          {form.scope === 'asset' ? (
            <PickerRow
              label="دارایی"
              value={selectedAsset?.name}
              placeholder="انتخاب دارایی"
              leading={<Activity size={15} />}
              onClick={() => setAssetPickerOpen(true)}
            />
          ) : (
            <PickerRow
              label="گروه"
              value={selectedCategory?.name}
              placeholder="انتخاب گروه"
              leading={<Folder size={15} />}
              onClick={() => setCategoryPickerOpen(true)}
            />
          )}
          {form.scope === 'asset' && (
            <Field label="نوع هدف">
              <SegmentedControl
                size="sm"
                value={form.targetKind}
                onChange={(targetKind) => setForm((prev) => ({ ...prev, targetKind }))}
                options={[
                  { value: 'allocation_percent', label: 'درصد از سبد' },
                  { value: 'quantity', label: 'مقدار' },
                ]}
              />
            </Field>
          )}
          <Field
            label={effectiveTargetKind === 'quantity' ? 'مقدار هدف' : 'درصد هدف'}
            error={percentInvalid && form.targetValue.trim() !== '' ? 'درصد باید بین ۰ و ۱۰۰ باشد.' : undefined}
          >
            <div className="relative">
              <FormattedNumberInput
                value={form.targetValue}
                onValueChange={(value) => setForm((prev) => ({ ...prev, targetValue: value }))}
                placeholder={effectiveTargetKind === 'quantity' ? 'مثلاً 2.5' : 'مثلاً 25'}
                className={`${fieldInputClass} text-left text-lg font-semibold`}
                dir="ltr"
              />
              {effectiveTargetKind === 'allocation_percent' && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-zinc-500">%</span>
              )}
            </div>
          </Field>
          {budgetValidation.issues.length > 0 && (
            <div className="space-y-1 rounded-xl bg-rose-500/10 px-3 py-2">
              {budgetValidation.issues.map((issue) => (
                <p key={issue} className="text-xs text-rose-200">
                  {issue}
                </p>
              ))}
            </div>
          )}
          <div className="rounded-xl bg-white/4 p-3">
            <p className="mb-3 text-xs text-zinc-500">با این هدف</p>
            {budgetSummary}
          </div>
          <PrimaryButton type="submit" disabled={!canSubmit}>
            {isSubmitting ? 'در حال ذخیره...' : form.editingId ? 'ذخیره تغییرات' : 'افزودن هدف'}
          </PrimaryButton>
        </form>
      </BottomSheet>

      <ListSheetPicker
        open={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        title="انتخاب دارایی"
        items={assetItems}
        value={form.assetId || null}
        onSelect={(id) => setForm((prev) => ({ ...prev, assetId: id ?? '' }))}
      />
      <CategorySheetPicker
        open={categoryPickerOpen}
        onClose={() => setCategoryPickerOpen(false)}
        title="انتخاب گروه دارایی"
        kind="asset"
        categories={categories}
        value={form.categoryId || null}
        onSelect={(id) => setForm((prev) => ({ ...prev, categoryId: id ?? '' }))}
      />
    </div>
  );
}

function BudgetProgressRow({
  label,
  used,
  total,
  tone,
}: {
  label: string;
  used: number;
  total: number;
  tone: 'normal' | 'danger';
}) {
  const remaining = Math.max(0, total - used);
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-300">{label}</span>
        <span className={tone === 'danger' ? 'text-rose-300' : 'text-zinc-500'}>
          <Money className={tone === 'danger' ? '' : 'text-zinc-200'}>{used.toFixed(1)}%</Money> استفاده ·{' '}
          <Money>{remaining.toFixed(1)}%</Money> آزاد
        </span>
      </div>
      <ProgressBar value={used} max={total} tone={tone === 'danger' ? 'negative' : 'accent'} />
    </div>
  );
}

function GoalRow({
  goal,
  name,
  assetUnit,
  pending,
  progress,
  onOpen,
  onMore,
}: {
  goal: Goal;
  name: string;
  assetUnit?: string;
  pending: boolean;
  progress: GoalProgress | null;
  onOpen: () => void;
  onMore: () => void;
}) {
  const kind = goalValueKindFromGoal(goal.target_kind);
  return (
    <div className={`px-4 py-3.5 space-y-3 ${pending ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-right">
          <IconBadge size="sm">{goal.scope === 'asset' ? <Activity size={15} /> : <Folder size={15} />}</IconBadge>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-zinc-100">{name}</span>
            <span className="block text-xs text-zinc-500">
              {goal.scope === 'asset' ? 'دارایی' : 'گروه'} · {goal.target_kind === 'quantity' ? 'هدف مقداری' : 'درصد سبد'}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={onMore}
          aria-label="گزینه‌ها"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-500 hover:bg-white/6 hover:text-zinc-200"
        >
          <MoreHorizontal size={18} />
        </button>
      </div>
      <GoalProgressDisplay label="" kind={kind} unit={assetUnit ?? ''} progress={progress} showIcon={false} />
    </div>
  );
}
