'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowRight,
  Check,
  ChevronDown,
  Edit3,
  Folder,
  Percent,
  Target,
  Trash2,
  X,
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
import { runOptimisticMutation } from '@/shared/utils/optimistic-mutation';
import {
  buildAssetSnapshots,
  calculateAssetGoalProgress,
  calculateGroupGoalProgress,
  totalSnapshotValueToman,
} from '@/features/goals/utils/goal-progress';

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
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { assets, categories, transactions, goals, setGoals } = useData();
  const { currencyMode, usdRate } = useUI();

  const [form, setForm] = useState<FormState>(emptyForm);
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

  if (!user) return null;

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
  const canSubmit = !isSubmitting && !targetMissing && !targetInvalid;

  const switchScope = (scope: GoalScope) => {
    setForm({
      ...emptyForm,
      scope,
      targetKind: scope === 'asset_group' ? 'allocation_percent' : 'allocation_percent',
    });
  };

  const resetForm = () => setForm(emptyForm);

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
    if (!canSubmit) return;
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (goal: Goal) => {
    if (!window.confirm('این هدف حذف شود؟')) return;
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

  return (
    <div className="bg-[#0F1015] min-h-full pb-10 animate-in slide-in-from-right-8 duration-300">
      <div className="sticky top-0 bg-[#161722]/90 backdrop-blur-md px-6 py-4 flex items-center gap-4 border-b border-white/5 z-20">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 -mr-2 bg-white/5 rounded-full text-slate-300 hover:bg-white/10"
          aria-label="بازگشت"
        >
          <ArrowRight size={20} />
        </button>
        <h2 className="text-lg font-bold text-white flex-1">هدف‌ها</h2>
      </div>

      <div className="p-6 space-y-6">
        <form
          onSubmit={handleSubmit}
          className="bg-[#1A1B26] border border-white/5 rounded-3xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-purple-300">
              <Target size={18} />
              <span className="font-semibold">
                {form.editingId ? 'ویرایش هدف' : 'هدف جدید'}
              </span>
            </div>
            {form.editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1"
              >
                <X size={14} />
                لغو
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#0F1015] p-1">
            <button
              type="button"
              onClick={() => switchScope('asset')}
              className={`rounded-xl py-2 text-sm transition ${
                form.scope === 'asset'
                  ? 'bg-purple-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              دارایی
            </button>
            <button
              type="button"
              onClick={() => switchScope('asset_group')}
              className={`rounded-xl py-2 text-sm transition ${
                form.scope === 'asset_group'
                  ? 'bg-purple-500 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              گروه دارایی
            </button>
          </div>

          {form.scope === 'asset' ? (
            <PickerButton
              label="دارایی"
              value={selectedAsset?.name ?? 'انتخاب دارایی'}
              empty={!selectedAsset}
              icon={<Activity size={16} />}
              onClick={() => setAssetPickerOpen(true)}
            />
          ) : (
            <PickerButton
              label="گروه دارایی"
              value={selectedCategory?.name ?? 'انتخاب گروه'}
              empty={!selectedCategory}
              icon={<Folder size={16} />}
              onClick={() => setCategoryPickerOpen(true)}
            />
          )}

          {form.scope === 'asset' && (
            <div className="grid grid-cols-2 gap-2">
              <TargetKindButton
                selected={form.targetKind === 'allocation_percent'}
                icon={<Percent size={15} />}
                label="درصد از سبد"
                onClick={() =>
                  setForm((prev) => ({ ...prev, targetKind: 'allocation_percent' }))
                }
              />
              <TargetKindButton
                selected={form.targetKind === 'quantity'}
                icon={<Activity size={15} />}
                label="تعداد/مقدار"
                onClick={() => setForm((prev) => ({ ...prev, targetKind: 'quantity' }))}
              />
            </div>
          )}

          <label className="block space-y-2">
            <span className="text-xs text-slate-400">
              {effectiveTargetKind === 'quantity' ? 'هدف مقداری' : 'هدف درصدی'}
            </span>
            <div className="relative">
              <FormattedNumberInput
                value={form.targetValue}
                onValueChange={(value) => setForm((prev) => ({ ...prev, targetValue: value }))}
                placeholder={effectiveTargetKind === 'quantity' ? 'مثلا 2.5' : 'مثلا 25'}
                className="w-full bg-[#0F1015] border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:border-purple-500 outline-none"
              />
              {effectiveTargetKind === 'allocation_percent' && (
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">
                  %
                </span>
              )}
            </div>
            {percentInvalid && (
              <span className="text-[11px] text-rose-300">درصد باید بین ۰ و ۱۰۰ باشد.</span>
            )}
          </label>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 text-white rounded-xl py-3 font-semibold transition"
          >
            {isSubmitting ? 'در حال ذخیره...' : form.editingId ? 'ذخیره تغییرات' : 'افزودن هدف'}
          </button>
        </form>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">هدف‌های فعال</h3>
            <span className="text-xs text-slate-500">{goals.length.toLocaleString('fa-IR')}</span>
          </div>

          {sortedGoals.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-8 bg-[#1A1B26] border border-white/5 rounded-2xl">
              هنوز هدفی ثبت نشده است.
            </div>
          ) : (
            <div className="space-y-3">
              {sortedGoals.map((goal) => (
                <GoalRow
                  key={goal.id}
                  goal={goal}
                  assetName={goal.asset_id ? assetById.get(goal.asset_id)?.name : undefined}
                  categoryName={
                    goal.category_id ? categoryById.get(goal.category_id)?.name : undefined
                  }
                  pending={pendingGoalIds.has(goal.id)}
                  progress={
                    goal.scope === 'asset'
                      ? calculateAssetGoalProgress(goal, snapshots, totalValueToman)
                      : calculateGroupGoalProgress(goal, snapshots, totalValueToman)
                  }
                  onEdit={() => handleEdit(goal)}
                  onDelete={() => void handleDelete(goal)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

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

function PickerButton({
  label,
  value,
  empty,
  icon,
  onClick,
}: {
  label: string;
  value: string;
  empty: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full bg-[#0F1015] border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3 text-right hover:border-purple-500/40 transition"
    >
      <span className="text-slate-500">{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[11px] text-slate-500">{label}</span>
        <span className={`block text-sm truncate ${empty ? 'text-slate-500' : 'text-white'}`}>
          {value}
        </span>
      </span>
      <ChevronDown size={16} className="text-slate-600" />
    </button>
  );
}

function TargetKindButton({
  selected,
  icon,
  label,
  onClick,
}: {
  selected: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-3 text-sm flex items-center justify-center gap-2 transition ${
        selected
          ? 'bg-purple-500/10 border-purple-500/40 text-purple-200'
          : 'bg-[#0F1015] border-white/10 text-slate-400 hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function GoalRow({
  goal,
  assetName,
  categoryName,
  pending,
  progress,
  onEdit,
  onDelete,
}: {
  goal: Goal;
  assetName?: string;
  categoryName?: string;
  pending: boolean;
  progress: { percentComplete: number; current: number; target: number } | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const name = goal.scope === 'asset' ? (assetName ?? 'دارایی حذف‌شده') : (categoryName ?? 'گروه حذف‌شده');
  const target =
    goal.target_kind === 'quantity'
      ? Number(goal.target_quantity ?? 0).toLocaleString('en-US')
      : `${Number(goal.target_percent ?? 0).toFixed(1)}%`;
  const current =
    goal.target_kind === 'quantity'
      ? Number(progress?.current ?? 0).toLocaleString('en-US')
      : `${Number(progress?.current ?? 0).toFixed(1)}%`;
  const width = Math.min(100, progress?.percentComplete ?? 0);

  return (
    <div
      className={`bg-[#1A1B26] border border-white/5 rounded-2xl p-4 space-y-3 ${
        pending ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-300 flex items-center justify-center shrink-0">
              {goal.scope === 'asset' ? <Activity size={15} /> : <Folder size={15} />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{name}</p>
              <p className="text-[11px] text-slate-500">
                {goal.target_kind === 'quantity' ? 'هدف مقداری' : 'هدف درصدی'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="w-8 h-8 rounded-lg bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center"
            aria-label="ویرایش هدف"
          >
            <Edit3 size={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 flex items-center justify-center"
            aria-label="حذف هدف"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs" dir="ltr">
          <span className="text-slate-400">{current}</span>
          <span className="text-slate-300">{target}</span>
        </div>
        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full bg-linear-to-r from-purple-500 to-cyan-400"
            style={{ width: `${width}%` }}
          />
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-500" dir="ltr">
          <Check size={11} />
          {(progress?.percentComplete ?? 0).toFixed(1)}%
        </div>
      </div>
    </div>
  );
}
