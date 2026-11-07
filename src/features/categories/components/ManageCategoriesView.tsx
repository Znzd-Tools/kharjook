'use client';

import { BottomSheet } from '@/shared/components/BottomSheet';
import { EmptyState } from '@/shared/components/EmptyState';
import {
  ActionSheet,
  Field,
  HeaderAction,
  PageHeader,
  PickerRow,
  PrimaryButton,
  SegmentedControl,
  SortableListRow,
  fieldInputClass,
} from '@/shared/components/ui';
import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Edit3,
  Folder,
  Trash2,
} from 'lucide-react';
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
import { supabase } from '@/shared/lib/supabase/client';
import { CategorySheetPicker } from '@/shared/components/CategorySheetPicker';
import { FormattedNumberInput } from '@/shared/components/FormattedNumberInput';
import { useToast } from '@/shared/components/Toast';
import { useConfirm } from '@/shared/components/ConfirmDialog';
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
};

export function ManageCategoriesView() {
  const toast = useToast();
  const { confirm } = useConfirm();
  const { user } = useAuth();
  const { categories, setCategories } = useData();

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

  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionCategoryId, setActionCategoryId] = useState<string | null>(null);

  if (!user) return null;

  const switchTab = (kind: CategoryKind) => {
    if (kind === activeKind) return;
    setActiveKind(kind);
    setForm(emptyForm);
  };

  const resetForm = () => {
    setForm(emptyForm);
    setSheetOpen(false);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setSheetOpen(true);
  };

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.error('نام دسته الزامی است.');
      return;
    }

    const parentId = activeKind === 'asset' ? null : form.parentId;

    // Defense in depth: a client can't make a category its own ancestor.
    if (parentId && form.editingId && descendantsOfEditing.has(parentId)) {
      toast.error('نمی‌توان والدی انتخاب کرد که خودش زیرمجموعه‌ی این دسته است.');
      return;
    }

    const execute = async () => {
      if (form.editingId) {
        const editingId = form.editingId;
        const snapshot = categories;
        const patch = { name, color: form.color, parent_id: parentId };
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
    });
    setSheetOpen(true);
  };

  const handleDelete = async (cat: Category) => {
    if (!(await confirm({ message: DELETE_PROMPTS[cat.kind], variant: 'danger', confirmLabel: 'حذف' }))) return;

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

  const submitLabel = isSubmitting
    ? 'در حال ثبت...'
    : form.editingId
      ? 'ثبت تغییرات'
      : 'افزودن دسته';

  const actionCategory = categories.find((c) => c.id === actionCategoryId) ?? null;

  return (
    <div className="bg-surface-shell min-h-full pb-10 animate-[slide-fade-in-right_300ms_ease-out]">
      <PageHeader title="دسته‌بندی‌ها" actions={<HeaderAction label="دسته جدید" onClick={openCreate} />} />

      <div className="px-4 pt-5 space-y-4">
        <SegmentedControl
          value={activeKind}
          onChange={switchTab}
          options={KIND_TABS.map((t) => ({ value: t.id, label: t.label }))}
        />

        {roots.length === 0 ? (
          <EmptyState
            icon={<Folder size={22} />}
            title="هیچ دسته‌ای ثبت نشده."
            actionLabel="ساخت دسته"
            onAction={openCreate}
          />
        ) : (
          <>
            <p className="px-1 text-xs text-zinc-500">
              برای جابجایی، دستگیره را بکش. زیرمجموعه‌ها زیر دستهٔ اصلی نمایش داده می‌شوند.
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
              <SortableContext items={roots.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                <div className="overflow-hidden rounded-2xl border border-white/5 bg-surface-raised divide-y divide-white/5">
                  {roots.map((root) => (
                    <CategoryNode
                      key={root.id}
                      category={root}
                      depth={0}
                      childrenByParent={childrenByParent}
                      onEdit={handleEdit}
                      onMore={(c) => setActionCategoryId(c.id)}
                      pendingIds={pendingCategoryIds}
                      capsByCategoryId={capsByCategoryId}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>

      <ActionSheet
        open={actionCategory !== null}
        onClose={() => setActionCategoryId(null)}
        title={actionCategory?.name}
        actions={
          actionCategory
            ? [
                { label: 'ویرایش', icon: <Edit3 size={17} />, onSelect: () => handleEdit(actionCategory) },
                {
                  label: 'حذف',
                  icon: <Trash2 size={17} />,
                  tone: 'danger',
                  disabled: pendingCategoryIds.has(actionCategory.id),
                  onSelect: () => void handleDelete(actionCategory),
                },
              ]
            : []
        }
      />

      <BottomSheet open={sheetOpen} onClose={resetForm} title={form.editingId ? 'ویرایش دسته' : 'دسته جدید'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="نام" htmlFor="category-name">
            <input
              id="category-name"
              type="text"
              placeholder={namePlaceholder}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={fieldInputClass}
              required
              maxLength={64}
            />
          </Field>
          <Field label="رنگ">
            <div className="flex flex-wrap gap-2.5" role="group" aria-label="رنگ دسته">
              {CATEGORY_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  aria-label={`رنگ ${c}`}
                  aria-pressed={form.color === c}
                  className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-95 ${
                    form.color === c ? 'ring-2 ring-zinc-50 ring-offset-2 ring-offset-surface-overlay' : ''
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {form.color === c && <Check size={15} className="text-white" />}
                </button>
              ))}
            </div>
          </Field>
          {activeKind !== 'asset' && (
            <PickerRow
              label="زیرمجموعهٔ"
              value={selectedParent?.name}
              placeholder="هیچ‌کدام (دستهٔ اصلی)"
              leading={
                selectedParent ? (
                  <span className="block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedParent.color }} />
                ) : (
                  <Folder size={14} />
                )
              }
              onClick={() => setParentPickerOpen(true)}
            />
          )}
          {activeKind === 'expense' && (
            <Field
              label="سقف هزینه ماهانه (تومان)"
              htmlFor="category-monthly-cap"
              hint="اختیاری. هزینهٔ زیرمجموعه‌ها هم حساب می‌شود."
            >
              <FormattedNumberInput
                id="category-monthly-cap"
                value={form.monthlyCapToman}
                onValueChange={(value) => setForm((prev) => ({ ...prev, monthlyCapToman: value }))}
                className={`${fieldInputClass} text-left`}
                dir="ltr"
                placeholder="مثلاً ۵,۰۰۰,۰۰۰"
              />
            </Field>
          )}
          <PrimaryButton type="submit" disabled={isSubmitting}>
            {submitLabel}
          </PrimaryButton>
        </form>
      </BottomSheet>

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
  onMore: (c: Category) => void;
  pendingIds: Set<string>;
  capsByCategoryId: Map<string, CategorySpendingCap>;
}

function CategoryNode({
  category,
  depth,
  childrenByParent,
  onEdit,
  onMore,
  pendingIds,
  capsByCategoryId,
}: CategoryNodeProps) {
  const kids = childrenByParent.get(category.id) ?? [];
  const pending = pendingIds.has(category.id);
  const capLimitToman = capsByCategoryId.get(category.id)?.monthly_limit_toman ?? null;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  return (
    <div>
      <SortableListRow
        rowRef={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition, opacity: pending ? 0.5 : undefined }}
        handleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
        onOpen={() => onEdit(category)}
        onMore={() => onMore(category)}
        leading={<span className="block h-3 w-3 rounded-full" style={{ backgroundColor: category.color }} />}
        title={category.name}
        subtitle={
          [
            kids.length > 0 ? `${kids.length.toLocaleString('fa-IR')} زیرمجموعه` : null,
            capLimitToman != null && capLimitToman > 0
              ? `سقف ماهانه ${Number(capLimitToman).toLocaleString('en-US')}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ') || undefined
        }
      />
      {kids.length > 0 && (
        <div className={`border-t border-white/5 divide-y divide-white/5 ${depth === 0 ? 'pr-6' : 'pr-4'}`}>
          <SortableContext items={kids.map((k) => k.id)} strategy={verticalListSortingStrategy}>
            {kids.map((kid) => (
              <CategoryNode
                key={kid.id}
                category={kid}
                depth={depth + 1}
                childrenByParent={childrenByParent}
                onEdit={onEdit}
                onMore={onMore}
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
