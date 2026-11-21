'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, LayoutGrid as Folder, Pencil, Trash2 } from '@/design-system/icons';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Amount,
  AmountField,
  Badge,
  Button,
  EmptyState,
  Field,
  IconButton,
  Input,
  ListRow,
  Section,
  SegmentedControl,
  Text,
  TopBar,
  toast,
  useConfirm,
} from '@/design-system';
import { useSafeBack } from '@/shared/hooks/use-safe-back';
import { categoryScope, type CategoryScope } from '@/features/portfolio/utils/total-wealth';
import { supabase } from '@/shared/lib/supabase/client';
import { CategorySheetPicker } from '@/shared/components/CategorySheetPicker';
import { runOptimisticMutation } from '@/shared/utils/optimistic-mutation';
import { haptic } from '@/shared/utils/haptics';
import type { Category, CategoryKind, CategorySpendingCap } from '@/shared/types/domain';
import { useAuth, useData } from '@/features/portfolio/PortfolioProvider';
import { CATEGORY_COLORS } from '@/features/categories/constants/category-colors';

type FormState = {
  editingId: string | null;
  name: string;
  color: string;
  parentId: string | null;
  monthlyCapToman: string;
  /** Asset categories: where the assets of the category count. */
  scope: CategoryScope;
};

const KIND_TABS: { id: CategoryKind; label: string }[] = [
  { id: 'asset', label: 'دارایی' },
  { id: 'income', label: 'درآمد' },
  { id: 'expense', label: 'هزینه' },
];

const DELETE_PROMPTS: Record<CategoryKind, string> = {
  asset: 'مطمئنی؟ با پاک کردن دسته، دارایی‌های مرتبط بی‌دسته میشن.',
  income: 'مطمئنی؟ با پاک کردن دسته، تراکنش‌های مرتبط بی‌دسته میشن.',
  expense: 'مطمئنی؟ با پاک کردن دسته، تراکنش‌های مرتبط بی‌دسته میشن.',
};

const emptyForm: FormState = {
  editingId: null,
  name: '',
  color: CATEGORY_COLORS[0],
  parentId: null,
  monthlyCapToman: '',
  scope: 'portfolio',
};

const SCOPE_HELP: Record<CategoryScope, string> = {
  portfolio: 'دارایی‌های این دسته در سبد، اهداف و دارایی کل می‌آیند.',
  wealth_only: 'فقط در «دارایی کل» می‌آیند، نه در سبد و اهداف (مثل رهن).',
  ignored: 'در هیچ جمعی نمی‌آیند و فقط در فهرست دارایی‌ها دیده می‌شوند (مثل سهمی که قیمت بازار ندارد).',
};

export function ManageCategoriesView() {
  const goBack = useSafeBack('/settings');
  const confirm = useConfirm();
  const { user } = useAuth();
  const { categories, setCategories, assets, setAssets } = useData();

  const [activeKind, setActiveKind] = useState<CategoryKind>('asset');
  const [form, setForm] = useState<FormState>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parentPickerOpen, setParentPickerOpen] = useState(false);
  const [pendingCategoryIds, setPendingCategoryIds] = useState<Set<string>>(new Set());
  const [capsByCategoryId, setCapsByCategoryId] = useState<Map<string, CategorySpendingCap>>(
    new Map()
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.from('category_spending_caps').select('*');
      if (cancelled || error) return;
      setCapsByCategoryId(
        new Map(((data ?? []) as CategorySpendingCap[]).map((cap) => [cap.category_id, cap]))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Categories scoped to the current tab.
  const scoped = useMemo(
    () => categories.filter((c) => c.kind === activeKind),
    [categories, activeKind]
  );

  // Tree derivation. Orphans (parent_id points to missing row or to a row in a
  // different kind) surface as top-level so the user can recover them.
  const { roots, childrenByParent } = useMemo(() => {
    const byId = new Map(scoped.map((c) => [c.id, c]));
    const rootList: Category[] = [];
    const childMap = new Map<string, Category[]>();

    scoped.forEach((c) => {
      if (c.parent_id && byId.has(c.parent_id)) {
        const arr = childMap.get(c.parent_id) ?? [];
        arr.push(c);
        childMap.set(c.parent_id, arr);
      } else {
        rootList.push(c);
      }
    });

    // Stable order inside each bucket: creation order (backend already sorts).
    return { roots: rootList, childrenByParent: childMap };
  }, [scoped]);

  // Set of ids that are descendants of the category currently being edited.
  // Used to prevent cycles when picking a parent.
  const descendantsOfEditing = useMemo(() => {
    if (!form.editingId) return new Set<string>();
    const acc = new Set<string>();
    const stack = [form.editingId];
    while (stack.length) {
      const id = stack.pop()!;
      const kids = childrenByParent.get(id) ?? [];
      for (const k of kids) {
        if (!acc.has(k.id)) {
          acc.add(k.id);
          stack.push(k.id);
        }
      }
    }
    return acc;
  }, [form.editingId, childrenByParent]);

  // Ids the parent picker must hide: the category being edited plus its entire
  // descendant subtree. Prevents re-parenting into a cycle.
  const parentExcludeIds = useMemo<ReadonlySet<string>>(() => {
    if (!form.editingId) return descendantsOfEditing;
    const s = new Set(descendantsOfEditing);
    s.add(form.editingId);
    return s;
  }, [descendantsOfEditing, form.editingId]);

  const selectedParent = useMemo(
    () =>
      form.parentId
        ? categories.find((c) => c.id === form.parentId) ?? null
        : null,
    [categories, form.parentId]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } })
  );

  if (!user) return null;

  const switchTab = (kind: CategoryKind) => {
    if (kind === activeKind) return;
    setActiveKind(kind);
    setForm(emptyForm);
  };

  const resetForm = () => setForm(emptyForm);

  const persistCategoryCap = async (categoryId: string, rawLimit: string) => {
    const trimmed = rawLimit.trim();
    if (!trimmed) {
      const { error } = await supabase
        .from('category_spending_caps')
        .delete()
        .eq('category_id', categoryId);
      if (error) throw error;
      setCapsByCategoryId((prev) => {
        const next = new Map(prev);
        next.delete(categoryId);
        return next;
      });
      return;
    }

    const limit = Number(trimmed);
    if (!Number.isFinite(limit) || limit <= 0) {
      throw new Error('سقف ماهانه نامعتبر است.');
    }

    const { data, error } = await supabase
      .from('category_spending_caps')
      .upsert(
        {
          user_id: user!.id,
          category_id: categoryId,
          monthly_limit_toman: limit,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,category_id' }
      )
      .select()
      .single();
    if (error) throw error;
    const saved = data as CategorySpendingCap;
    setCapsByCategoryId((prev) => new Map(prev).set(categoryId, saved));
  };

  /**
   * The category flag is the default for its assets: when it changes, copy
   * it to `include_in_balance` of every asset in the category, so all the
   * portfolio numbers (which read the asset flag) follow.
   */
  const syncAssetsToCategory = async (categoryId: string, inPortfolio: boolean) => {
    const targets = assets.filter(
      (a) => a.category_id === categoryId && (a.include_in_balance !== false) !== inPortfolio
    );
    if (targets.length === 0) return;
    const { error } = await supabase
      .from('assets')
      .update({ include_in_balance: inPortfolio })
      .eq('category_id', categoryId);
    if (error) throw error;
    setAssets((prev) =>
      prev.map((a) => (a.category_id === categoryId ? { ...a, include_in_balance: inPortfolio } : a))
    );
    toast.success(
      inPortfolio
        ? `${targets.length.toLocaleString('fa-IR')} دارایی به سبد سرمایه‌گذاری اضافه شد.`
        : `${targets.length.toLocaleString('fa-IR')} دارایی از سبد سرمایه‌گذاری خارج شد.`
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.error('نام دسته الزامی است.');
      return;
    }

    const parentId = activeKind === 'asset' ? null : form.parentId;
    // Only asset categories carry the portfolio flag.
    const scope: CategoryScope = activeKind === 'asset' ? form.scope : 'portfolio';
    const inPortfolio = scope === 'portfolio';
    const ignoreInWealth = scope === 'ignored';

    // Defense in depth: a client can't make a category its own ancestor.
    if (parentId && form.editingId && descendantsOfEditing.has(parentId)) {
      toast.error('نمی‌توان والدی انتخاب کرد که خودش زیرمجموعه‌ی این دسته است.');
      return;
    }

    const execute = async () => {
      if (form.editingId) {
        const editingId = form.editingId;
        const snapshot = categories;
        const patch = {
          name,
          color: form.color,
          parent_id: parentId,
          in_portfolio: inPortfolio,
          ignore_in_wealth: ignoreInWealth,
        };
        const before = categories.find((c) => c.id === editingId);
        const portfolioChanged =
          activeKind === 'asset' && (before?.in_portfolio !== false) !== inPortfolio;
        await runOptimisticMutation({
          snapshot,
          applyOptimistic: () => {
            setPendingCategoryIds((prev) => new Set(prev).add(editingId));
            setCategories((prev) =>
              prev.map((c) =>
                c.id === editingId ? { ...c, ...patch } : c
              )
            );
          },
          rollback: (prev) => {
            setPendingCategoryIds((p) => {
              const next = new Set(p);
              next.delete(editingId);
              return next;
            });
            setCategories(prev);
          },
          commit: async () => {
            const { data, error } = await supabase
              .from('categories')
              .update(patch)
              .eq('id', editingId)
              .select()
              .single();
            if (error) throw error;
            return data as Category;
          },
          onSuccess: (saved) => {
            setPendingCategoryIds((p) => {
              const next = new Set(p);
              next.delete(editingId);
              return next;
            });
            setCategories((prev) =>
              prev.map((c) => (c.id === editingId ? saved : c))
            );
          },
        });
        if (activeKind === 'expense') {
          await persistCategoryCap(editingId, form.monthlyCapToman);
        }
        if (portfolioChanged) {
          await syncAssetsToCategory(editingId, inPortfolio);
        }
      } else {
        const nextOrder =
          scoped
            .filter((c) => c.parent_id === (activeKind === 'asset' ? null : form.parentId))
            .reduce(
              (max, c) => Math.max(max, Number.isFinite(c.order_index) ? Number(c.order_index) : -1),
              -1
            ) + 1;
        const snapshot = categories;
        const tempId = `temp-category-${crypto.randomUUID()}`;
        let savedCategoryId: string | null = null;
        const optimisticCategory: Category = {
          id: tempId,
          user_id: user.id,
          name,
          color: form.color,
          kind: activeKind,
          parent_id: parentId,
          in_portfolio: inPortfolio,
          ignore_in_wealth: ignoreInWealth,
          order_index: nextOrder,
          created_at: new Date().toISOString(),
        };
        await runOptimisticMutation({
          snapshot,
          applyOptimistic: () => {
            setPendingCategoryIds((prev) => new Set(prev).add(tempId));
            setCategories((prev) => [...prev, optimisticCategory]);
          },
          rollback: (prev) => {
            setPendingCategoryIds((p) => {
              const next = new Set(p);
              next.delete(tempId);
              return next;
            });
            setCategories(prev);
          },
          commit: async () => {
            const { data, error } = await supabase
              .from('categories')
              .insert([
                {
                  user_id: user.id,
                  name,
                  color: form.color,
                  kind: activeKind,
                  parent_id: parentId,
                  in_portfolio: inPortfolio,
                  ignore_in_wealth: ignoreInWealth,
                  order_index: nextOrder,
                },
              ])
              .select()
              .single();
            if (error) throw error;
            return data as Category;
          },
          onSuccess: (saved) => {
            savedCategoryId = saved.id;
            setPendingCategoryIds((p) => {
              const next = new Set(p);
              next.delete(tempId);
              return next;
            });
            setCategories((prev) =>
              prev.map((c) => (c.id === tempId ? saved : c))
            );
          },
        });
        if (activeKind === 'expense' && form.monthlyCapToman.trim() && savedCategoryId) {
          await persistCategoryCap(savedCategoryId, form.monthlyCapToman);
        }
      }
      resetForm();
    };
    setIsSubmitting(true);
    try {
      await execute();
    } catch (err) {
      console.error(err);
      toast.error('خطا در ثبت دسته‌بندی.', {
        action: { label: 'تلاش مجدد', onClick: () => void execute() },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (cat: Category) => {
    const cap = capsByCategoryId.get(cat.id);
    setForm({
      editingId: cat.id,
      name: cat.name,
      color: cat.color,
      parentId: cat.parent_id,
      monthlyCapToman: cap ? String(cap.monthly_limit_toman) : '',
      scope: categoryScope(cat),
    });
  };

  const handleDelete = async (cat: Category) => {
    if (!(await confirm({ title: `«${cat.name}» حذف شود؟`, description: DELETE_PROMPTS[cat.kind], confirmLabel: 'حذف', tone: 'danger' }))) return;

    const execute = async () => {
      const snapshot = categories;
      await runOptimisticMutation({
        snapshot,
        applyOptimistic: () => {
          setPendingCategoryIds((prev) => new Set(prev).add(cat.id));
          // DB cascades parent_id → null on direct children (and category_id →
          // null on transactions), so direct children become roots; grandchildren
          // keep their parent. Mirror that locally.
          setCategories((prev) =>
            prev
              .map((c) => (c.parent_id === cat.id ? { ...c, parent_id: null } : c))
              .filter((c) => c.id !== cat.id)
          );
        },
        rollback: (prev) => {
          setPendingCategoryIds((p) => {
            const next = new Set(p);
            next.delete(cat.id);
            return next;
          });
          setCategories(prev);
        },
        commit: async () => {
          const { error } = await supabase
            .from('categories')
            .delete()
            .eq('id', cat.id);
          if (error) throw error;
        },
        onSuccess: () => {
          setPendingCategoryIds((p) => {
            const next = new Set(p);
            next.delete(cat.id);
            return next;
          });
        },
      });
      if (form.editingId === cat.id) resetForm();
    };
    try {
      await execute();
    } catch (err) {
      console.error(err);
      toast.error('خطا در حذف.', {
        action: { label: 'تلاش مجدد', onClick: () => void execute() },
      });
    }
  };

  const reorderCategorySiblings = async (activeId: string, overId: string) => {
    if (activeId === overId) return;
    let nextSiblings: Category[] = [];
    setCategories((prev) => {
      const scopedPrev = prev.filter((c) => c.kind === activeKind);
      const from = scopedPrev.find((c) => c.id === activeId);
      const to = scopedPrev.find((c) => c.id === overId);
      if (!from || !to) return prev;
      if ((from.parent_id ?? null) !== (to.parent_id ?? null)) return prev;
      const siblings = scopedPrev.filter((c) => (c.parent_id ?? null) === (from.parent_id ?? null));
      const fromIndex = siblings.findIndex((c) => c.id === activeId);
      const toIndex = siblings.findIndex((c) => c.id === overId);
      if (fromIndex < 0 || toIndex < 0) return prev;

      nextSiblings = arrayMove(siblings, fromIndex, toIndex);
      const withOrder = new Map<string, number>();
      nextSiblings.forEach((c, idx) => withOrder.set(c.id, idx));
      return prev.map((c) =>
        withOrder.has(c.id) ? { ...c, order_index: withOrder.get(c.id) } : c
      );
    });
    if (nextSiblings.length === 0) return;
    const results = await Promise.all(
      nextSiblings.map((c, idx) =>
        supabase.from('categories').update({ order_index: idx }).eq('id', c.id)
      )
    );
    const err = results.find((r) => r.error)?.error;
    if (err) {
      console.error(err);
      toast.error('ذخیره ترتیب دسته‌ها ناموفق بود.');
      const { data } = await supabase
        .from('categories')
        .select('*')
        .order('order_index', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      if (data) setCategories(data as Category[]);
    }
  };
  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    haptic('selection');
    void reorderCategorySiblings(String(active.id), String(over.id));
  };
  const onDragStart = () => {
    haptic('light');
  };

  const namePlaceholder =
    activeKind === 'asset'
      ? 'نام دسته (مثلا: خودرو)'
      : activeKind === 'income'
        ? 'نام دسته (مثلا: حقوق)'
        : 'نام دسته (مثلا: خوراک)';

  const submitLabel = form.editingId ? 'ثبت تغییرات' : 'افزودن دسته';

  return (
    <div className="min-h-full bg-canvas pb-10">
      <TopBar onBack={goBack} title="دسته‌بندی‌ها" />

      <div className="space-y-5 px-(--ds-gutter)">
        <SegmentedControl<CategoryKind>
          aria-label="نوع دسته"
          value={activeKind}
          onValueChange={switchTab}
          options={KIND_TABS.map((t) => ({ value: t.id, label: t.label }))}
        />

        <form onSubmit={handleSubmit} className="space-y-4 rounded-card bg-panel p-4">
          <div className="flex items-center justify-between">
            <Text variant="callout" weight="semibold">
              {form.editingId ? 'ویرایش دسته' : 'دسته جدید'}
            </Text>
            {form.editingId && (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                انصراف
              </Button>
            )}
          </div>

          <Field label="نام دسته">
            <Input
              id="category-name"
              placeholder={namePlaceholder}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              maxLength={64}
            />
          </Field>

          <Field label="رنگ">
            <div className="flex flex-wrap gap-2" role="group" aria-label="رنگ دسته">
              {CATEGORY_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  aria-label={`رنگ ${c}`}
                  aria-pressed={form.color === c}
                  className="ds-focus flex size-9 items-center justify-center rounded-full"
                  style={{ backgroundColor: c }}
                >
                  {form.color === c && <Check className="size-4 text-fg-on-accent" />}
                </button>
              ))}
            </div>
          </Field>

          {activeKind !== 'asset' && (
            <Field label="زیرمجموعه‌ی (اختیاری)">
              <button
                type="button"
                onClick={() => setParentPickerOpen(true)}
                className="ds-focus flex h-12 w-full items-center gap-3 rounded-control bg-sunken px-3 text-start text-callout"
              >
                {selectedParent ? (
                  <>
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: selectedParent.color }} />
                    <span className="min-w-0 flex-1 truncate text-fg">{selectedParent.name}</span>
                  </>
                ) : (
                  <>
                    <Folder className="size-4 shrink-0 text-fg-subtle" />
                    <span className="min-w-0 flex-1 text-fg-subtle">بدون والد (دسته اصلی)</span>
                  </>
                )}
              </button>
            </Field>
          )}

          {activeKind === 'asset' && (
            <Field label="در کدام جمع حساب شود؟" hint={SCOPE_HELP[form.scope]}>
              <SegmentedControl<CategoryScope>
                aria-label="در کدام جمع حساب شود؟"
                size="sm"
                value={form.scope}
                onValueChange={(scope) => setForm({ ...form, scope })}
                options={[
                  { value: 'portfolio', label: 'سبد سرمایه‌گذاری' },
                  { value: 'wealth_only', label: 'فقط دارایی کل' },
                  { value: 'ignored', label: 'نادیده' },
                ]}
              />
            </Field>
          )}

          {activeKind === 'expense' && (
            <Field label="سقف هزینه ماهانه (اختیاری)" hint="هزینه زیرمجموعه‌ها هم حساب می‌شود.">
              <AmountField
                aria-label="سقف هزینه ماهانه"
                value={form.monthlyCapToman}
                onValueChange={(value) => setForm((prev) => ({ ...prev, monthlyCapToman: value }))}
              />
            </Field>
          )}

          <Button type="submit" fullWidth loading={isSubmitting} variant={form.editingId ? 'primary' : 'secondary'}>
            {submitLabel}
          </Button>
        </form>

        <Section title="دسته‌ها" description="برای جابه‌جایی، دستگیره کنار هر نام را بکش.">
          {roots.length === 0 ? (
            <div className="rounded-card bg-panel">
              <EmptyState compact title="هنوز دسته‌ای نیست" />
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
              <SortableContext items={roots.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {roots.map((root) => (
                    <CategoryNode
                      key={root.id}
                      category={root}
                      depth={0}
                      childrenByParent={childrenByParent}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      pendingIds={pendingCategoryIds}
                      capsByCategoryId={capsByCategoryId}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </Section>
      </div>

      {activeKind !== 'asset' && (
        <CategorySheetPicker
          open={parentPickerOpen}
          onClose={() => setParentPickerOpen(false)}
          title="انتخاب دستهٔ والد"
          kind={activeKind}
          categories={categories}
          value={form.parentId}
          onSelect={(id) => setForm({ ...form, parentId: id })}
          allowNone
          noneLabel="بدون والد (دسته اصلی)"
          excludeIds={parentExcludeIds}
        />
      )}
    </div>
  );
}

interface CategoryNodeProps {
  category: Category;
  depth: number;
  childrenByParent: Map<string, Category[]>;
  onEdit: (c: Category) => void;
  onDelete: (c: Category) => void;
  pendingIds: Set<string>;
  capsByCategoryId: Map<string, CategorySpendingCap>;
}

function CategoryNode({
  category,
  depth,
  childrenByParent,
  onEdit,
  onDelete,
  pendingIds,
  capsByCategoryId,
}: CategoryNodeProps) {
  const kids = childrenByParent.get(category.id) ?? [];
  const compact = depth > 0;
  const pending = pendingIds.has(category.id);
  const capLimitToman = capsByCategoryId.get(category.id)?.monthly_limit_toman ?? null;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  return (
    <div className="space-y-2">
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className={`rounded-card bg-panel ${isDragging ? 'opacity-70 ring-1 ring-accent' : ''} ${pending ? 'opacity-60' : ''}`}
      >
        <ListRow
          asListItem={false}
          size={compact ? 'sm' : 'md'}
          chevron={false}
          leading={
            <span className="flex items-center gap-2">
              <button
                type="button"
                {...attributes}
                {...listeners}
                style={{ touchAction: 'none' }}
                className="ds-focus cursor-grab rounded px-1 text-fg-subtle active:cursor-grabbing"
                aria-label={`جابجایی ${category.name}`}
              >
                ⋮⋮
              </button>
              <span className={`${compact ? 'size-2.5' : 'size-3'} shrink-0 rounded-full`} style={{ backgroundColor: category.color }} />
            </span>
          }
          title={
            <span className="inline-flex min-w-0 items-center gap-2">
              <span className="truncate">{category.name}</span>
              {category.kind === 'asset' && categoryScope(category) !== 'portfolio' && (
                <Badge>{categoryScope(category) === 'ignored' ? 'نادیده' : 'فقط دارایی کل'}</Badge>
              )}
            </span>
          }
          subtitle={
            capLimitToman != null && capLimitToman > 0 ? (
              <span className="inline-flex items-center gap-1">
                سقف ماهانه <Amount value={Number(capLimitToman)} size="xs" compact />
              </span>
            ) : undefined
          }
          trailing={
            <span className="flex">
              <IconButton size="sm" aria-label={`ویرایش ${category.name}`} icon={<Pencil />} disabled={pending} onClick={() => onEdit(category)} />
              <IconButton size="sm" aria-label={`حذف ${category.name}`} icon={<Trash2 />} disabled={pending} onClick={() => void onDelete(category)} />
            </span>
          }
        />
      </div>
      {kids.length > 0 && (
        <div className="ms-4 space-y-2 border-s border-line ps-3">
          <SortableContext items={kids.map((k) => k.id)} strategy={verticalListSortingStrategy}>
            {kids.map((kid) => (
              <CategoryNode
                key={kid.id}
                category={kid}
                depth={depth + 1}
                childrenByParent={childrenByParent}
                onEdit={onEdit}
                onDelete={onDelete}
                pendingIds={pendingIds}
                capsByCategoryId={capsByCategoryId}
              />
            ))}
          </SortableContext>
        </div>
      )}
    </div>
  );
}
