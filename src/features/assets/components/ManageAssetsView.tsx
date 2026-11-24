'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Badge, Button, Disclosure, EmptyState, Field, IconButton, Input, ListRow, Section, Switch, Text, TopBar, toast, useConfirm } from '@/design-system';
import { Archive, Coins, LayoutGrid as Folder, Pencil, TrendingUp as Link2, Trash2 } from '@/design-system/icons';
import { useSafeBack } from '@/shared/hooks/use-safe-back';
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
import { useArchive } from '@/features/archive/hooks/use-archive';
import { CategorySheetPicker } from '@/shared/components/CategorySheetPicker';
import { IconPicker } from '@/shared/components/IconPicker';
import {
  ListSheetPicker,
  type ListSheetPickerItem,
} from '@/shared/components/ListSheetPicker';
import { runOptimisticMutation } from '@/shared/utils/optimistic-mutation';
import { haptic } from '@/shared/utils/haptics';
import { findPriceSourceInCatalog } from '@/features/prices/constants/price-sources';
import { categoryPortfolioDefault } from '@/features/portfolio/utils/total-wealth';

export function ManageAssetsView() {
  const router = useRouter();
  const confirm = useConfirm();
  const goBack = useSafeBack('/assets');
  const { user } = useAuth();
  const { categories, assets, setAssets, priceSourceCatalog, archivedAssets } = useData();
  const { archiveAsset } = useArchive();

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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setEditingId(null);
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
        title: 'این دارایی حذف شود؟',
        description: 'همه‌ی تراکنش‌های این دارایی (خرید، فروش و…) هم برای همیشه پاک می‌شوند.',
        tone: 'danger',
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

  const pickerButton = 'ds-focus flex h-12 w-full items-center gap-3 rounded-control bg-sunken px-3 text-start text-callout';

  return (
    <div className="min-h-full bg-canvas pb-10">
      <TopBar onBack={goBack} title="دارایی‌ها" />

      <div className="space-y-5 px-(--ds-gutter)">
        <form onSubmit={handleSubmit} className="space-y-4 rounded-card bg-panel p-4">
          <div className="flex items-center justify-between">
            <Text variant="callout" weight="semibold">
              {editingId ? 'ویرایش دارایی' : 'دارایی جدید'}
            </Text>
            {editingId && (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                انصراف
              </Button>
            )}
          </div>

          <IconPicker
            value={formData.iconUrl}
            onChange={(url) => setFormData({ ...formData, iconUrl: url })}
            userId={user.id}
            folder="assets"
            fallback={<Coins className="size-6 text-fg-muted" />}
            label="آیکون (اختیاری)"
          />

          <div className="grid grid-cols-2 gap-3">
            <Field label="نام دارایی">
              <Input id="asset-name" placeholder="مثلاً طلا" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
            </Field>
            <Field label="واحد">
              <Input id="asset-unit" placeholder="مثلاً گرم" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} required />
            </Field>
          </div>

          <Field label="دسته‌بندی (اختیاری)">
            <button type="button" onClick={() => setCategoryPickerOpen(true)} className={pickerButton}>
              {selectedCategory ? (
                <>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: selectedCategory.color }} />
                  <span className="min-w-0 flex-1 truncate text-fg">{selectedCategory.name}</span>
                </>
              ) : (
                <>
                  <Folder className="size-4 shrink-0 text-fg-subtle" />
                  <span className="min-w-0 flex-1 text-fg-subtle">بدون دسته</span>
                </>
              )}
            </button>
          </Field>
          <Button type="button" variant="link" size="sm" onClick={() => router.push('/manage/categories')}>
            مدیریت دسته‌ها
          </Button>

          <Field label="منبع قیمت (اختیاری)">
            <button type="button" onClick={() => setPriceSourcePickerOpen(true)} className={pickerButton}>
              <Link2 className={`size-4 shrink-0 ${selectedPriceSourceLabel ? (selectedPriceSource ? 'text-accent-ink' : 'text-warning-ink') : 'text-fg-subtle'}`} />
              <span className={`min-w-0 flex-1 truncate ${selectedPriceSourceLabel ? 'text-fg' : 'text-fg-subtle'}`}>
                {selectedPriceSourceLabel ?? 'دستی (بدون منبع)'}
              </span>
            </button>
          </Field>

          <Disclosure title="تنظیمات پیشرفته" open={showAdvanced} onOpenChange={setShowAdvanced}>
            <div className="space-y-4 pb-2">
              <Field label="تعداد اعشار نمایش مقدار" hint="فقط روی نمایش اثر دارد.">
                <Input
                  type="number"
                  inputMode="numeric"
                  dir="ltr"
                  min={0}
                  max={12}
                  step={1}
                  value={formData.decimalPlaces}
                  onChange={(e) => setFormData({ ...formData, decimalPlaces: Number(e.target.value) })}
                  required
                />
              </Field>
              <Switch
                label="جزو سبد سرمایه‌گذاری"
                description="خاموش: فقط در «دارایی کل» می‌آید، نه در سبد و اهداف. پیش‌فرض از دسته‌بندی می‌آید."
                checked={formData.includeInBalance}
                onCheckedChange={(c) => setFormData({ ...formData, includeInBalance: c })}
              />
              <Switch
                label="در سود و زیان حساب شود"
                description="خاموش: در گزارش سود و زیان نمی‌آید."
                checked={formData.includeInProfitLoss}
                onCheckedChange={(c) => setFormData({ ...formData, includeInProfitLoss: c })}
              />
            </div>
          </Disclosure>

          <Button type="submit" fullWidth loading={isSubmitting} variant={editingId ? 'primary' : 'secondary'}>
            {editingId ? 'ثبت تغییرات' : 'ذخیره دارایی'}
          </Button>
        </form>

        <Section
          title="دارایی‌ها"
          description="برای جابه‌جایی، دستگیره کنار هر نام را بکش."
          action={
            <Button variant="link" size="sm" render={<Link href="/manage/archive" />} nativeButton={false}>
              بایگانی{archivedAssets.length > 0 ? ` (${archivedAssets.length.toLocaleString('fa-IR')})` : ''}
            </Button>
          }
        >
          {assets.length === 0 ? (
            <div className="rounded-card bg-panel">
              <EmptyState compact icon={<Coins />} title="هنوز دارایی‌ای نیست" />
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
              <SortableContext items={assets.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {assets.map((asset) => {
                    const cat = categories.find((c) => c.id === asset.category_id);
                    const source = findPriceSourceInCatalog(asset.price_source_id, priceSourceCatalog);
                    return (
                      <SortableAssetRow
                        key={asset.id}
                        asset={asset}
                        editing={editingId === asset.id}
                        catName={cat ? cat.name : 'بدون دسته'}
                        color={cat?.color}
                        sourceLabel={source?.label ?? null}
                        onEdit={() => handleEdit(asset)}
                        onDelete={() => void handleDelete(asset.id)}
                        onArchive={() => void archiveAsset(asset).then((ok) => ok && editingId === asset.id && resetForm())}
                        pending={pendingAssetIds.has(asset.id)}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </Section>
      </div>

      <CategorySheetPicker
        open={categoryPickerOpen}
        onClose={() => setCategoryPickerOpen(false)}
        title="انتخاب دسته‌بندی دارایی"
        kind="asset"
        categories={categories}
        value={formData.categoryId || null}
        onSelect={(id) => {
          // A category outside the portfolio keeps its assets out by default.
          const picked = id ? categories.find((c) => c.id === id) : null;
          const includeInBalance = categoryPortfolioDefault(picked);
          setFormData({ ...formData, categoryId: id ?? '', includeInBalance });
          if (!includeInBalance) setShowAdvanced(true);
        }}
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
        noneLeading={<Link2 className="size-4" />}
        emptyLabel="منبع قیمتی پیکربندی نشده."
      />
    </div>
  );
}

function SortableAssetRow({
  asset,
  editing,
  catName,
  color,
  sourceLabel,
  onEdit,
  onDelete,
  onArchive,
  pending,
}: {
  asset: Asset;
  editing: boolean;
  catName: string;
  color?: string;
  sourceLabel: string | null;
  onEdit: () => void;
  onDelete: () => void;
  onArchive: () => void;
  pending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: asset.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-card bg-panel ${editing ? 'ring-1 ring-accent' : ''} ${isDragging ? 'opacity-70 ring-1 ring-accent' : ''} ${pending ? 'opacity-60' : ''}`}
    >
      <ListRow
        asListItem={false}
        chevron={false}
        leading={
          <span className="flex items-center gap-2">
            <button
              type="button"
              {...attributes}
              {...listeners}
              style={{ touchAction: 'none' }}
              className="ds-focus cursor-grab rounded px-1 text-fg-subtle active:cursor-grabbing"
              aria-label={`جابجایی ${asset.name}`}
            >
              ⋮⋮
            </button>
            <Avatar src={asset.icon_url} name={asset.name} fallback={<Coins />} color={color} />
          </span>
        }
        title={asset.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-1">
            <span>
              {catName} · {asset.unit}
            </span>
            {asset.include_in_balance === false && <Badge tone="info">خارج از سبد</Badge>}
            {asset.include_in_profit_loss === false && <Badge tone="warning">خارج از سود و زیان</Badge>}
            {sourceLabel && <Badge tone="accent">{sourceLabel}</Badge>}
          </span>
        }
        trailing={
          <span className="flex">
            <IconButton size="sm" aria-label={`ویرایش ${asset.name}`} icon={<Pencil />} disabled={pending} onClick={onEdit} />
            <IconButton size="sm" aria-label={`بایگانی ${asset.name}`} icon={<Archive />} disabled={pending} onClick={onArchive} />
            <IconButton size="sm" aria-label={`حذف ${asset.name}`} icon={<Trash2 />} disabled={pending} onClick={onDelete} />
          </span>
        }
      />
    </div>
  );
}
