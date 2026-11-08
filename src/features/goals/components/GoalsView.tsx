'use client';

/**
 * Asset goals (اهداف تخصیص): how the portfolio should be split, and what to
 * buy or sell to get there. One card per goal: now vs target on one bar,
 * the gap, and a concrete action. Add / edit in a sheet; same rules as before.
 */
import { useMemo, useState } from 'react';
import {
  AmountField,
  Avatar,
  Badge,
  Banner,
  Button,
  EmptyState,
  Field,
  PickerField,
  SegmentedControl,
  Sheet,
  Text,
  TopBar,
  toast,
  useConfirm,
} from '@/design-system';
import { CheckCircle2, Coins, Plus, Target } from '@/design-system/icons';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuth, useData, useUI } from '@/features/portfolio/PortfolioProvider';
import type { Goal, GoalScope, GoalTargetKind } from '@/shared/types/domain';
import { useSafeBack } from '@/shared/hooks/use-safe-back';
import { buildGoalDriftRows, type GoalDriftRow } from '../utils/goal-drift-rows';
import { formatGoalValue, isGoalMet } from '../utils/goal-progress-display';
import { validateGoalSet } from '../utils/goal-validation';

interface Draft {
  id: string | null;
  scope: GoalScope;
  assetId: string | null;
  categoryId: string | null;
  kind: GoalTargetKind;
  value: string;
}

const EMPTY: Draft = { id: null, scope: 'asset_group', assetId: null, categoryId: null, kind: 'allocation_percent', value: '' };

export function GoalsView() {
  const goBack = useSafeBack('/assets');
  const confirm = useConfirm();
  const { user } = useAuth();
  const { assets, categories, transactions, goals, setGoals } = useData();
  const { currencyMode, usdRate } = useUI();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(
    () => buildGoalDriftRows({ goals, assets, categories, transactions, currencyMode, usdRate }),
    [goals, assets, categories, transactions, currencyMode, usdRate]
  );
  const rowById = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const assetCats = categories.filter((c) => c.kind === 'asset');

  const met = rows.filter((r) => isGoalMet(r.currentValue, r.targetValue, r.valueKind)).length;
  const groupGoals = goals.filter((g) => g.scope === 'asset_group');
  const assetGoals = goals.filter((g) => g.scope === 'asset');
  const groupSum = groupGoals.reduce((s, g) => s + Number(g.target_percent ?? 0), 0);

  const openNew = () => setDraft({ ...EMPTY, scope: assetCats.length ? 'asset_group' : 'asset' });
  const openEdit = (goal: Goal) =>
    setDraft({
      id: goal.id,
      scope: goal.scope,
      assetId: goal.asset_id,
      categoryId: goal.category_id,
      kind: goal.target_kind,
      value: String(goal.target_percent ?? goal.target_quantity ?? ''),
    });

  const save = async () => {
    if (!draft || !user) return;
    const target = Number(draft.value);
    const kind: GoalTargetKind = draft.scope === 'asset_group' ? 'allocation_percent' : draft.kind;
    if (draft.scope === 'asset' ? !draft.assetId : !draft.categoryId) return toast.error(draft.scope === 'asset' ? 'دارایی را انتخاب کن' : 'گروه را انتخاب کن');
    if (!(target > 0) || (kind === 'allocation_percent' && target > 100)) return toast.error(kind === 'allocation_percent' ? 'درصد باید بین ۰ و ۱۰۰ باشد' : 'مقدار را وارد کن');
    const payload = {
      user_id: user.id,
      scope: draft.scope,
      asset_id: draft.scope === 'asset' ? draft.assetId : null,
      category_id: draft.scope === 'asset_group' ? draft.categoryId : null,
      target_kind: kind,
      target_quantity: kind === 'quantity' ? target : null,
      target_percent: kind === 'allocation_percent' ? target : null,
    };
    const next = [...goals.filter((g) => g.id !== draft.id), { ...payload, id: draft.id ?? '__new__' } as Goal];
    const issues = validateGoalSet(next, assets, categories);
    if (issues.length) return toast.error(issues[0]!);
    setSaving(true);
    const res = draft.id
      ? await supabase.from('goals').update(payload).eq('id', draft.id).select().single()
      : await supabase.from('goals').insert([payload]).select().single();
    setSaving(false);
    if (res.error) return toast.error('ذخیره هدف انجام نشد');
    const saved = res.data as Goal;
    setGoals((prev) => (draft.id ? prev.map((g) => (g.id === draft.id ? saved : g)) : [...prev, saved]));
    setDraft(null);
    toast.success('هدف ذخیره شد');
  };

  const remove = async (goal: Goal) => {
    if (!(await confirm({ title: 'این هدف حذف شود؟', confirmLabel: 'حذف', tone: 'danger' }))) return;
    const { error } = await supabase.from('goals').delete().eq('id', goal.id);
    if (error) return toast.error('حذف انجام نشد');
    setGoals((prev) => prev.filter((g) => g.id !== goal.id));
    setDraft(null);
    toast.show('هدف حذف شد');
  };

  const card = (goal: Goal) => {
    const r: GoalDriftRow | undefined = rowById.get(goal.id);
    if (!r) return null;
    const ok = isGoalMet(r.currentValue, r.targetValue, r.valueKind);
    const max = Math.max(r.targetValue, r.currentValue, 0.0001) * 1.15;
    const unit = r.valueKind === 'quantity' ? assets.find((a) => a.id === goal.asset_id)?.unit : undefined;
    return (
      <li key={goal.id}>
        <button type="button" onClick={() => openEdit(goal)} className="ds-focus block w-full space-y-3 rounded-card bg-panel p-4 text-start hover:bg-hover" aria-label={`هدف ${r.name}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-callout font-semibold text-fg">{r.name}</span>
              <Badge tone={ok ? 'positive' : 'warning'}>{ok ? 'روی هدف' : r.deltaLabel}</Badge>
            </span>
            <span className="shrink-0 text-caption text-fg-subtle">
              {formatGoalValue(r.currentValue, r.valueKind, unit ?? '')} / {formatGoalValue(r.targetValue, r.valueKind, unit ?? '')}
            </span>
          </div>
          {/* Now (fill) vs target (marker) on one bar. */}
          <div className="relative h-2.5 rounded-full bg-sunken" aria-hidden>
            <div className={`absolute inset-y-0 start-0 rounded-full ${ok ? 'bg-positive' : 'bg-accent'}`} style={{ width: `${Math.min(100, (r.currentValue / max) * 100)}%` }} />
            <div className="absolute -top-1 -bottom-1 w-0.5 rounded bg-fg" style={{ insetInlineStart: `${(r.targetValue / max) * 100}%` }} />
          </div>
          {!ok && r.actionSuggestion && <p className="text-caption text-accent-ink">{r.actionSuggestion}</p>}
        </button>
      </li>
    );
  };

  const editing = draft?.id ? goals.find((g) => g.id === draft.id) ?? null : null;

  return (
    <div className="min-h-full bg-canvas pb-10">
      <TopBar
        onBack={() => goBack()}
        title="اهداف تخصیص"
        actions={
          <Button size="sm" startIcon={<Plus />} onClick={openNew}>
            هدف جدید
          </Button>
        }
      />
      <div className="space-y-5 px-(--ds-gutter)">
        {goals.length === 0 ? (
          <div className="rounded-card bg-panel">
            <EmptyState
              icon={<Target />}
              title="هنوز هدفی نداری"
              description="بگو سبدت چطور تقسیم شود (مثلاً ۴۰٪ طلا، ۳۰٪ ارز). بعد می‌بینی چقدر فاصله داری و چه بخری یا بفروشی."
              action={<Button onClick={openNew}>ساخت اولین هدف</Button>}
            />
          </div>
        ) : (
          <>
            <section aria-label="خلاصه اهداف" className="flex items-center justify-between gap-3 rounded-card bg-panel p-4">
              <div>
                <Text variant="caption" tone="subtle">
                  روی هدف
                </Text>
                <p className="text-title font-bold text-fg">
                  {met.toLocaleString('fa-IR')} از {rows.length.toLocaleString('fa-IR')}
                </p>
                {groupGoals.length > 0 && (
                  <Text variant="caption" tone="subtle">
                    جمع هدف گروه‌ها: {groupSum.toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪
                  </Text>
                )}
              </div>
              <Avatar size="lg" tone={met === rows.length ? 'mint' : 'lilac'} fallback={met === rows.length ? <CheckCircle2 /> : <Target />} />
            </section>

            {groupGoals.length > 0 && (
              <section aria-label="گروه‌ها" className="space-y-2">
                <Text variant="caption" tone="muted" className="px-1 font-semibold">
                  گروه‌ها
                </Text>
                <ul className="space-y-2">{groupGoals.map(card)}</ul>
              </section>
            )}
            {assetGoals.length > 0 && (
              <section aria-label="دارایی‌ها" className="space-y-2">
                <Text variant="caption" tone="muted" className="px-1 font-semibold">
                  دارایی‌ها
                </Text>
                <ul className="space-y-2">{assetGoals.map(card)}</ul>
              </section>
            )}
          </>
        )}
      </div>

      <Sheet
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? 'ویرایش هدف' : 'هدف جدید'}
        footer={
          <div className="flex gap-2">
            <Button fullWidth size="lg" loading={saving} onClick={() => void save()}>
              ذخیره
            </Button>
            {editing && (
              <Button size="lg" variant="danger" onClick={() => void remove(editing)}>
                حذف
              </Button>
            )}
          </div>
        }
      >
        {draft && (
          <div className="space-y-4">
            {!draft.id && (
              <Field label="هدف برای">
                <SegmentedControl
                  aria-label="هدف برای"
                  value={draft.scope}
                  onValueChange={(v) => setDraft({ ...draft, scope: v as GoalScope, kind: 'allocation_percent' })}
                  options={[
                    { value: 'asset_group', label: 'یک گروه (مثلاً طلا)' },
                    { value: 'asset', label: 'یک دارایی' },
                  ]}
                />
              </Field>
            )}
            {draft.scope === 'asset_group' ? (
              <Field label="گروه">
                <PickerField
                  title="گروه دارایی"
                  disabled={Boolean(draft.id)}
                  options={assetCats
                    .filter((c) => draft.id || !groupGoals.some((g) => g.category_id === c.id))
                    .map((c) => ({ value: c.id, label: c.name }))}
                  value={draft.categoryId}
                  onValueChange={(v) => setDraft({ ...draft, categoryId: v })}
                />
              </Field>
            ) : (
              <>
                <Field label="دارایی">
                  <PickerField
                    title="دارایی"
                    disabled={Boolean(draft.id)}
                    options={assets
                      .filter((a) => draft.id || !assetGoals.some((g) => g.asset_id === a.id && g.target_kind === draft.kind))
                      .map((a) => ({ value: a.id, label: a.name, description: a.unit, leading: <Avatar size="sm" tone="lemon" fallback={<Coins />} /> }))}
                    value={draft.assetId}
                    onValueChange={(v) => setDraft({ ...draft, assetId: v })}
                  />
                </Field>
                <Field label="نوع هدف">
                  <SegmentedControl
                    aria-label="نوع هدف"
                    value={draft.kind}
                    onValueChange={(v) => setDraft({ ...draft, kind: v as GoalTargetKind })}
                    options={[
                      { value: 'allocation_percent', label: 'درصد از سبد' },
                      { value: 'quantity', label: 'مقدار' },
                    ]}
                  />
                </Field>
              </>
            )}
            <Field
              label={draft.kind === 'quantity' && draft.scope === 'asset' ? `مقدار هدف (${assets.find((a) => a.id === draft.assetId)?.unit ?? ''})` : 'درصد هدف از کل سبد'}
              hint={draft.kind === 'quantity' && draft.scope === 'asset' ? 'مثلاً ۱۰۰ گرم طلا.' : 'جمع همه گروه‌ها حداکثر ۱۰۰٪.'}
            >
              <AmountField value={draft.value} onValueChange={(v) => setDraft({ ...draft, value: v })} unitLabel={draft.kind === 'quantity' && draft.scope === 'asset' ? ' ' : '٪'} />
            </Field>
            {(() => {
              const issues = draft.value
                ? validateGoalSet(
                    [
                      ...goals.filter((g) => g.id !== draft.id),
                      {
                        id: draft.id ?? '__new__',
                        user_id: '',
                        scope: draft.scope,
                        asset_id: draft.scope === 'asset' ? draft.assetId : null,
                        category_id: draft.scope === 'asset_group' ? draft.categoryId : null,
                        target_kind: draft.scope === 'asset_group' ? 'allocation_percent' : draft.kind,
                        target_quantity: draft.kind === 'quantity' ? Number(draft.value) : null,
                        target_percent: draft.kind !== 'quantity' || draft.scope === 'asset_group' ? Number(draft.value) : null,
                      },
                    ],
                    assets,
                    categories
                  )
                : [];
              return issues.length ? <Banner tone="warning">{issues[0]}</Banner> : null;
            })()}
          </div>
        )}
      </Sheet>
    </div>
  );
}
