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
  SortableListRow,
  SwitchVisual,
  fieldInputClass,
} from '@/shared/components/ui';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ChevronDown,
  Edit3,
  Folder,
  Link2,
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
import { deleteEntityIcon } from '@/shared/utils/entity-icon-storage';
import type { Asset } from '@/shared/types/domain';
import { useAuth, useData } from '@/features/portfolio/PortfolioProvider';
import { CategorySheetPicker } from '@/shared/components/CategorySheetPicker';
import { EntityIcon } from '@/shared/components/EntityIcon';
import { IconPicker } from '@/shared/components/IconPicker';
import {
  ListSheetPicker,
  type ListSheetPickerItem,
} from '@/shared/components/ListSheetPicker';
import { useToast } from '@/shared/components/Toast';
import { useConfirm } from '@/shared/components/ConfirmDialog';
import { runOptimisticMutation } from '@/shared/utils/optimistic-mutation';
import { haptic } from '@/shared/utils/haptics';
import { findPriceSourceInCatalog } from '@/features/prices/constants/price-sources';

export function ManageAssetsView() {
  const router = useRouter();
  const toast = useToast();
  const { confirm } = useConfirm();
  const { user } = useAuth();
  const { categories, assets, setAssets, priceSourceCatalog } = useData();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    unit: '',
    decimalPlaces: 4,
    categoryId: '',
    iconUrl: null as string | null,
    priceSourceId: '' as string,
    includeInProfitLoss: true,
    includeInBalance: true,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [priceSourcePickerOpen, setPriceSourcePickerOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [pendingAssetIds, setPendingAssetIds] = useState<Set<string>>(new Set());

  const selectedCategory = useMemo(
    () =>
      formData.categoryId
        ? categories.find((c) => c.id === formData.categoryId) ?? null
        : null,
    [categories, formData.categoryId]
  );

  const priceSourceItems = useMemo<ListSheetPickerItem[]>(() => {
    const base: ListSheetPickerItem[] = priceSourceCatalog
      .filter((s) => !s.deprecated)
      .map((s) => ({
        id: s.slug,
        label: s.label,
        sublabel: s.slug,
        leading: <Link2 size={14} />,
      }));

    if (
      formData.priceSourceId &&
      !findPriceSourceInCatalog(formData.priceSourceId, priceSourceCatalog)
    ) {
      base.push({
        id: formData.priceSourceId,
        label: formData.priceSourceId,
        sublabel: 'نامعتبر — ممکن است از کاتالوگ حذف شده باشد',
        leading: <Link2 size={14} />,
      });
    }
    return base;
  }, [formData.priceSourceId, priceSourceCatalog]);

  const selectedPriceSource = findPriceSourceInCatalog(
    formData.priceSourceId,
    priceSourceCatalog
  );
  const selectedPriceSourceLabel = selectedPriceSource
    ? selectedPriceSource.label
    : formData.priceSourceId
      ? `${formData.priceSourceId} (نامعتبر)`
      : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 100, tolerance: 8 } })
  );
  const [sheetOpen, setSheetOpen] = useState(false);
  const [actionAssetId, setActionAssetId] = useState<string | null>(null);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.unit.trim()) {
      toast.error('نام و واحد دارایی الزامی است.');
      return;
    }
    const execute = async () => {
      const decimalPlaces = Math.max(0, Math.min(12, Math.trunc(Number(formData.decimalPlaces))));
      const payload = {
        category_id: formData.categoryId || null,
        name: formData.name,
        unit: formData.unit,
        decimal_places: Number.isFinite(decimalPlaces) ? decimalPlaces : 4,
        icon_url: formData.iconUrl,
        price_source_id: formData.priceSourceId || null,
        include_in_profit_loss: formData.includeInProfitLoss,
        include_in_balance: formData.includeInBalance,
      };

      if (editingId) {
        const currentId = editingId;
        const snapshot = assets;
        await runOptimisticMutation({
          snapshot,
          applyOptimistic: () => {
            setPendingAssetIds((prev) => new Set(prev).add(currentId));
            setAssets((prev) =>
              prev.map((a) => (a.id === currentId ? { ...a, ...payload } : a))
            );
          },
          rollback: (prev) => {
            setPendingAssetIds((p) => {
              const next = new Set(p);
              next.delete(currentId);
              return next;
            });
            setAssets(prev);
          },
          commit: async () => {
            const { data, error } = await supabase
              .from('assets')
              .update(payload)
              .eq('id', currentId)
              .select()
              .single();
            if (error) throw error;
            return data as Asset;
          },
          onSuccess: (saved) => {
            setPendingAssetIds((p) => {
              const next = new Set(p);
              next.delete(currentId);
              return next;
            });
            setAssets((prev) => prev.map((a) => (a.id === currentId ? saved : a)));
          },
        });
        resetForm();
      } else {
        const nextOrder =
          assets.reduce(
            (max, a) => Math.max(max, Number.isFinite(a.order_index) ? Number(a.order_index) : -1),
            -1
          ) + 1;
        const snapshot = assets;
        const tempId = `temp-asset-${crypto.randomUUID()}`;
        const optimisticAsset: Asset = {
          id: tempId,
          user_id: user.id,
          category_id: payload.category_id,
          name: payload.name,
          unit: payload.unit,
          decimal_places: payload.decimal_places,
          price_toman: 0,
          price_usd: 0,
          icon_url: payload.icon_url,
          price_source_id: payload.price_source_id,
          include_in_profit_loss: payload.include_in_profit_loss,
          include_in_balance: payload.include_in_balance,
          order_index: nextOrder,
          created_at: new Date().toISOString(),
        };
        await runOptimisticMutation({
          snapshot,
          applyOptimistic: () => {
            setPendingAssetIds((prev) => new Set(prev).add(tempId));
            setAssets((prev) => [...prev, optimisticAsset]);
          },
          rollback: (prev) => {
            setPendingAssetIds((p) => {
              const next = new Set(p);
              next.delete(tempId);
              return next;
            });
            setAssets(prev);
          },
          commit: async () => {
            const { data, error } = await supabase
              .from('assets')
              .insert([
                { ...payload, user_id: user.id, price_toman: 0, price_usd: 0, order_index: nextOrder },
              ])
              .select()
              .single();
            if (error) throw error;
            return data as Asset;
          },
          onSuccess: (saved) => {
            setPendingAssetIds((p) => {
              const next = new Set(p);
              next.delete(tempId);
              return next;
            });
            setAssets((prev) => prev.map((a) => (a.id === tempId ? saved : a)));
          },
        });
        resetForm();
      }
    };

    setIsSubmitting(true);
    try {
      await execute();
    } catch (err) {
      console.error(err);
      toast.error('ثبت دارایی ناموفق بود.', {
        action: { label: 'تلاش مجدد', onClick: () => void execute() },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const persistAssetOrder = async (ordered: Asset[]) => {
    const normalized = ordered.map((a, i) => ({ ...a, order_index: i }));
    const results = await Promise.all(
      normalized.map((a) =>
        supabase.from('assets').update({ order_index: a.order_index }).eq('id', a.id)
      )
    );
    const err = results.find((r) => r.error)?.error;
    if (err) {
      console.error(err);
      toast.error('ذخیره ترتیب دارایی‌ها ناموفق بود.');
      const { data } = await supabase
        .from('assets')
        .select('*')
        .order('order_index', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });
      if (data) setAssets(data as Asset[]);
    }
  };

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    haptic('selection');
    setAssets((prev) => {
      const fromIndex = prev.findIndex((a) => a.id === active.id);
      const toIndex = prev.findIndex((a) => a.id === over.id);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const reordered = arrayMove(prev, fromIndex, toIndex);
      void persistAssetOrder(reordered);
      return reordered;
    });
  };

  const onDragStart = () => {
    haptic('light');
  };

  const handleEdit = (asset: Asset) => {
    setEditingId(asset.id);
    const decimalPlaces = Number.isFinite(asset.decimal_places) ? asset.decimal_places : 4;
    const includeInProfitLoss = asset.include_in_profit_loss ?? true;
    const includeInBalance = asset.include_in_balance ?? true;
    setFormData({
      name: asset.name,
      unit: asset.unit,
      decimalPlaces,
      categoryId: asset.category_id || '',
      iconUrl: asset.icon_url ?? null,
      priceSourceId: asset.price_source_id ?? '',
      includeInProfitLoss,
      includeInBalance,
    });
    setShowAdvanced(
      decimalPlaces !== 4 || !includeInProfitLoss || !includeInBalance
    );
    setSheetOpen(true);
  };

  const resetForm = () => {
    setEditingId(null);
    setSheetOpen(false);
    setShowAdvanced(false);
    setFormData({
      name: '',
      unit: '',
      decimalPlaces: 4,
      categoryId: '',
      iconUrl: null,
      priceSourceId: '',
      includeInProfitLoss: true,
      includeInBalance: true,
    });
  };

  const handleDelete = async (id: string) => {
    if (
      !(await confirm({
        message:
          '⚠️ هشدار جدی:\nبا پاک کردن این دارایی، تمام تراکنش‌های متصل به آن (خرید، فروش و...) برای همیشه پاک خواهند شد!\nآیا مطمئن هستید؟',
        variant: 'danger',
        confirmLabel: 'حذف',
      }))
    )
      return;

    const execute = async () => {
      const snapshot = assets;
      await runOptimisticMutation({
        snapshot,
        applyOptimistic: () => {
          setPendingAssetIds((prev) => new Set(prev).add(id));
          setAssets((prev) => prev.filter((a) => a.id !== id));
        },
        rollback: (prev) => {
          setPendingAssetIds((p) => {
            const next = new Set(p);
            next.delete(id);
            return next;
          });
          setAssets(prev);
        },
        commit: async () => {
          const asset = snapshot.find((a) => a.id === id);
          const { error } = await supabase.from('assets').delete().eq('id', id);
          if (error) throw error;
          if (asset?.icon_url) {
            await deleteEntityIcon(supabase, asset.icon_url);
          }
        },
        onSuccess: () => {
          setPendingAssetIds((p) => {
            const next = new Set(p);
            next.delete(id);
            return next;
          });
        },
      });
      if (editingId === id) resetForm();
    };
    try {
      await execute();
    } catch {
      toast.error('حذف دارایی ناموفق بود.', {
        action: { label: 'تلاش مجدد', onClick: () => void execute() },
      });
    }
  };

  const openCreate = () => {
    resetForm();
    setSheetOpen(true);
  };
  const actionAsset = assets.find((a) => a.id === actionAssetId) ?? null;

  const toggle = (checked: boolean, label: string, hint: string, onToggle: () => void) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-3 rounded-xl bg-white/4 px-4 py-3 text-right"
    >
      <span className="min-w-0">
        <span className="block text-sm text-zinc-200">{label}</span>
        <span className="mt-0.5 block text-xs text-zinc-500">{hint}</span>
      </span>
      <SwitchVisual checked={checked} />
    </button>
  );

  return (
    <div className="bg-surface-shell min-h-full pb-10 animate-[slide-fade-in-right_300ms_ease-out]">
      <PageHeader title="مدیریت دارایی‌ها" actions={<HeaderAction label="دارایی جدید" onClick={openCreate} />} />

      <div className="px-4 pt-5 space-y-3">
        {assets.length === 0 ? (
          <EmptyState
            icon={<Activity size={22} />}
            title="هیچ دارایی تعریف نشده."
            description="طلا، ارز، رمزارز یا هر چیزی که قیمت دارد."
            actionLabel="تعریف دارایی"
            onAction={openCreate}
          />
        ) : (
          <>
            <p className="px-1 text-xs text-zinc-500">ترتیب این لیست، ترتیب نمایش در سبد است. برای جابجایی، دستگیره را بکش.</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
              <SortableContext items={assets.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                <div className="overflow-hidden rounded-2xl border border-white/5 bg-surface-raised divide-y divide-white/5">
                  {assets.map((asset) => {
                    const cat = categories.find((c) => c.id === asset.category_id);
                    const source = findPriceSourceInCatalog(asset.price_source_id, priceSourceCatalog);
                    return (
                      <SortableAssetRow
                        key={asset.id}
                        asset={asset}
                        catName={cat ? cat.name : 'بدون دسته'}
                        color={cat ? cat.color : '#64748b'}
                        sourceLabel={source?.label ?? null}
                        onOpen={() => handleEdit(asset)}
                        onMore={() => setActionAssetId(asset.id)}
                        pending={pendingAssetIds.has(asset.id)}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </>
        )}
      </div>

      <ActionSheet
        open={actionAsset !== null}
        onClose={() => setActionAssetId(null)}
        title={actionAsset?.name}
        actions={
          actionAsset
            ? [
                { label: 'ویرایش', icon: <Edit3 size={17} />, onSelect: () => handleEdit(actionAsset) },
                {
                  label: 'حذف',
                  icon: <Trash2 size={17} />,
                  tone: 'danger',
                  disabled: pendingAssetIds.has(actionAsset.id),
                  onSelect: () => void handleDelete(actionAsset.id),
                },
              ]
            : []
        }
      />

      <BottomSheet open={sheetOpen} onClose={resetForm} title={editingId ? 'ویرایش دارایی' : 'دارایی جدید'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <IconPicker
            value={formData.iconUrl}
            onChange={(url) => setFormData({ ...formData, iconUrl: url })}
            userId={user.id}
            folder="assets"
            fallback={<Activity size={22} className="text-zinc-400" />}
            label="آیکون (اختیاری)"
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="نام" htmlFor="asset-name">
              <input
                id="asset-name"
                type="text"
                placeholder="مثلاً طلا"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={fieldInputClass}
                required
              />
            </Field>
            <Field label="واحد" htmlFor="asset-unit">
              <input
                id="asset-unit"
                type="text"
                placeholder="مثلاً گرم"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                className={fieldInputClass}
                required
              />
            </Field>
          </div>
          <PickerRow
            label="گروه"
            value={selectedCategory?.name}
            placeholder="بدون گروه"
            leading={
              selectedCategory ? (
                <span className="block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: selectedCategory.color }} />
              ) : (
                <Folder size={14} />
              )
            }
            onClick={() => setCategoryPickerOpen(true)}
          />
          <PickerRow
            label="منبع قیمت"
            value={selectedPriceSourceLabel}
            placeholder="دستی (بدون منبع)"
            leading={<Link2 size={14} className={selectedPriceSourceLabel && !selectedPriceSource ? 'text-amber-400' : ''} />}
            onClick={() => setPriceSourcePickerOpen(true)}
          />

          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between py-1 text-xs font-medium text-zinc-400 hover:text-zinc-200"
          >
            تنظیمات پیشرفته
            <ChevronDown size={16} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>
          {showAdvanced && (
            <div className="space-y-3">
              <Field label="تعداد اعشار نمایش مقدار" hint="فقط نمایش را کنترل می‌کند.">
                <input
                  type="number"
                  min={0}
                  max={12}
                  step={1}
                  value={formData.decimalPlaces}
                  onChange={(e) => setFormData({ ...formData, decimalPlaces: Number(e.target.value) })}
                  className={`${fieldInputClass} text-left`}
                  dir="ltr"
                  required
                />
              </Field>
              {toggle(formData.includeInBalance, 'در ارزش کل سبد حساب شود', 'خاموش: در جمع داشبورد نمی‌آید', () =>
                setFormData({ ...formData, includeInBalance: !formData.includeInBalance })
              )}
              {toggle(formData.includeInProfitLoss, 'در سود و زیان حساب شود', 'خاموش: در گزارش سود/زیان نمی‌آید', () =>
                setFormData({ ...formData, includeInProfitLoss: !formData.includeInProfitLoss })
              )}
            </div>
          )}

          <PrimaryButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'در حال ثبت...' : editingId ? 'ذخیره تغییرات' : 'افزودن دارایی'}
          </PrimaryButton>
          <button
            type="button"
            onClick={() => router.push('/manage/categories')}
            className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300"
          >
            مدیریت گروه‌ها
          </button>
        </form>
      </BottomSheet>

      <CategorySheetPicker
        open={categoryPickerOpen}
        onClose={() => setCategoryPickerOpen(false)}
        title="انتخاب دسته‌بندی دارایی"
        kind="asset"
        categories={categories}
        value={formData.categoryId || null}
        onSelect={(id) =>
          setFormData({ ...formData, categoryId: id ?? '' })
        }
        allowNone
        noneLabel="بدون دسته"
      />

      <ListSheetPicker
        open={priceSourcePickerOpen}
        onClose={() => setPriceSourcePickerOpen(false)}
        title="انتخاب منبع قیمت"
        items={priceSourceItems}
        value={formData.priceSourceId || null}
        onSelect={(id) =>
          setFormData({ ...formData, priceSourceId: id ?? '' })
        }
        allowNone
        noneLabel="دستی (بدون منبع)"
        noneLeading={<Link2 size={14} />}
        emptyLabel="منبع قیمتی پیکربندی نشده."
      />
    </div>
  );
}

function SortableAssetRow({
  asset,
  catName,
  color,
  sourceLabel,
  onOpen,
  onMore,
  pending,
}: {
  asset: Asset;
  catName: string;
  color: string;
  sourceLabel: string | null;
  onOpen: () => void;
  onMore: () => void;
  pending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: asset.id });
  const flags = [
    asset.include_in_balance === false ? 'خارج از سبد' : null,
    asset.include_in_profit_loss === false ? 'بدون سود/زیان' : null,
  ].filter(Boolean);
  return (
    <SortableListRow
      rowRef={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: pending ? 0.5 : undefined }}
      handleProps={{ ...attributes, ...listeners }}
      isDragging={isDragging}
      onOpen={onOpen}
      onMore={onMore}
      leading={
        <EntityIcon
          iconUrl={asset.icon_url}
          fallback={<Activity size={17} />}
          bgColor={`${color}1f`}
          color={color}
          className="h-10 w-10 shrink-0 rounded-full!"
        />
      }
      title={asset.name}
      subtitle={
        <>
          {catName} · {asset.unit}
          {sourceLabel ? ` · ${sourceLabel}` : ''}
          {flags.length > 0 && <span className="text-amber-300/70"> · {flags.join(' · ')}</span>}
        </>
      }
    />
  );
}
