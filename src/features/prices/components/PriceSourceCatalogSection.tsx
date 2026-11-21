'use client';

import { useMemo, useState } from 'react';
import { Button, Field, IconButton, Input, List, ListRow, SegmentedControl, Text, toast } from '@/design-system';
import { Pencil, Plus, Trash2 } from '@/design-system/icons';
import { supabase } from '@/shared/lib/supabase/client';
import type { PriceSourceRecord } from '@/shared/types/domain';
import { useAuth, useData } from '@/features/portfolio/PortfolioProvider';
import type { PriceSourceProvider } from '@/features/prices/constants/price-sources';
import { isValidSlug, suggestSlug } from '@/features/prices/utils/price-source-catalog';

const PROVIDER_OPTIONS: { value: PriceSourceProvider; label: string }[] = [
  { value: 'abantether', label: 'آبان‌تتر' },
  { value: 'zarpay', label: 'زرپی' },
];

type EditForm = {
  label: string;
  fetchKey: string;
  provider: PriceSourceProvider;
  slug: string;
};

export function PriceSourceCatalogSection() {
  const { user } = useAuth();
  const { assets, priceSources, setPriceSources, setPriceSourceSettings } = useData();
  const [adding, setAdding] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<EditForm>({
    label: '',
    fetchKey: '',
    provider: 'abantether',
    slug: '',
  });

  const boundSlugs = useMemo(() => {
    const set = new Set<string>();
    for (const asset of assets) {
      if (asset.price_source_id) set.add(asset.price_source_id);
    }
    return set;
  }, [assets]);

  const visibleSources = useMemo(
    () => priceSources.filter((source) => !source.deprecated),
    [priceSources]
  );

  const resetForm = (provider: PriceSourceProvider = 'abantether') => {
    setForm({ label: '', fetchKey: '', provider, slug: '' });
  };

  const startAdd = () => {
    resetForm();
    setEditingSlug(null);
    setAdding(true);
  };

  const startEdit = (source: PriceSourceRecord) => {
    setAdding(false);
    setEditingSlug(source.slug);
    setForm({
      label: source.label,
      fetchKey: source.fetch_key ?? '',
      provider: source.provider,
      slug: source.slug,
    });
  };

  const cancelForm = () => {
    setAdding(false);
    setEditingSlug(null);
    resetForm();
  };

  const handleFetchKeyChange = (fetchKey: string, provider: PriceSourceProvider) => {
    setForm((prev) => ({
      ...prev,
      fetchKey,
      provider,
      slug: adding ? suggestSlug(provider, fetchKey) : prev.slug,
    }));
  };

  const saveNew = async () => {
    if (!user) return;
    const label = form.label.trim();
    const fetchKey = form.fetchKey.trim();
    const slug = form.slug.trim().toLowerCase();

    if (!label) {
      toast.error('نام منبع را وارد کن.');
      return;
    }
    if (!fetchKey) {
      toast.error('کلید دریافت (fetch key) را وارد کن.');
      return;
    }
    if (!isValidSlug(slug)) {
      toast.error('شناسه (slug) نامعتبر است.');
      return;
    }
    if (priceSources.some((s) => s.slug === slug)) {
      toast.error('این شناسه قبلاً ثبت شده.');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const row: PriceSourceRecord = {
        user_id: user.id,
        slug,
        provider: form.provider,
        label,
        fetch_key: fetchKey,
        updates_rate: null,
        deprecated: false,
        is_builtin: false,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await supabase
        .from('price_sources')
        .insert(row)
        .select()
        .single();
      if (error) throw error;

      await supabase.from('price_source_settings').upsert(
        {
          user_id: user.id,
          slug,
          conversion_rate: 1,
          usd_factor: 'none',
          updated_at: now,
        },
        { onConflict: 'user_id,slug' }
      );

      const saved = data as PriceSourceRecord;
      setPriceSources((prev) => [...prev, saved].sort((a, b) => a.slug.localeCompare(b.slug)));
      setPriceSourceSettings((prev) => [
        ...prev.filter((row) => row.slug !== slug),
        {
          user_id: user.id,
          slug,
          conversion_rate: 1,
          usd_factor: 'none',
          updated_at: now,
        },
      ]);
      toast.success('منبع قیمت اضافه شد.');
      cancelForm();
    } catch (err) {
      console.error(err);
      toast.error('خطا در افزودن منبع قیمت.');
    } finally {
      setIsSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!user || !editingSlug) return;
    const source = priceSources.find((s) => s.slug === editingSlug);
    if (!source) return;

    const label = form.label.trim();
    const fetchKey = form.fetchKey.trim();

    if (!label) {
      toast.error('نام منبع را وارد کن.');
      return;
    }
    if (!fetchKey) {
      toast.error('کلید دریافت (fetch key) را وارد کن.');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const patch = source.is_builtin
        ? { label, updated_at: now }
        : { label, fetch_key: fetchKey, updated_at: now };

      const { data, error } = await supabase
        .from('price_sources')
        .update(patch)
        .eq('user_id', user.id)
        .eq('slug', editingSlug)
        .select()
        .single();
      if (error) throw error;

      const saved = data as PriceSourceRecord;
      setPriceSources((prev) =>
        prev.map((row) => (row.slug === editingSlug ? saved : row))
      );
      toast.success('منبع قیمت به‌روز شد.');
      cancelForm();
    } catch (err) {
      console.error(err);
      toast.error('خطا در ذخیره منبع قیمت.');
    } finally {
      setIsSaving(false);
    }
  };

  const removeSource = async (source: PriceSourceRecord) => {
    if (!user) return;
    if (source.is_builtin) {
      toast.error('منابع پیش‌فرض قابل حذف نیستند.');
      return;
    }
    if (boundSlugs.has(source.slug)) {
      toast.error('این منبع به یک دارایی متصل است — ابتدا اتصال را قطع کن.');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('price_sources')
        .delete()
        .eq('user_id', user.id)
        .eq('slug', source.slug);
      if (error) throw error;

      setPriceSources((prev) => prev.filter((row) => row.slug !== source.slug));
      toast.success('منبع حذف شد.');
      if (editingSlug === source.slug) cancelForm();
    } catch (err) {
      console.error(err);
      toast.error('خطا در حذف منبع.');
    } finally {
      setIsSaving(false);
    }
  };

  const editingSource = editingSlug
    ? priceSources.find((s) => s.slug === editingSlug)
    : null;
  const fetchKeyLocked = !!editingSource?.is_builtin;

  const showForm = adding || editingSlug !== null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <Text variant="caption" tone="muted" weight="medium">
          منابع قیمت
        </Text>
        {!showForm && (
          <Button variant="link" size="sm" startIcon={<Plus />} onClick={startAdd}>
            افزودن
          </Button>
        )}
      </div>
      <Text variant="caption" tone="subtle">
        ارائه‌دهنده (آبان‌تتر / زرپی) ثابت است؛ نام، کلید دریافت و شناسه را می‌توانی سفارشی کنی.
      </Text>

      <List className="bg-sunken">
        {visibleSources.map((source) => (
          <ListRow
            key={source.slug}
            size="sm"
            chevron={false}
            title={source.label}
            subtitle={
              <span dir="ltr">
                {source.slug} · {source.provider} · {source.fetch_key}
              </span>
            }
            trailing={
              <span className="flex">
                <IconButton size="sm" aria-label={`ویرایش ${source.label}`} icon={<Pencil />} onClick={() => startEdit(source)} />
                {!source.is_builtin && (
                  <IconButton size="sm" aria-label={`حذف ${source.label}`} icon={<Trash2 />} disabled={isSaving} onClick={() => void removeSource(source)} />
                )}
              </span>
            }
          />
        ))}
      </List>

      {showForm && (
        <div className="space-y-4 rounded-card bg-sunken p-4">
          <Text variant="callout" weight="semibold">
            {adding ? 'منبع جدید' : 'ویرایش منبع'}
          </Text>
          {adding && (
            <Field label="ارائه‌دهنده">
              <SegmentedControl
                aria-label="ارائه‌دهنده"
                size="sm"
                value={form.provider}
                onValueChange={(v) =>
                  setForm((prev) => ({ ...prev, provider: v as typeof prev.provider, slug: suggestSlug(v as typeof prev.provider, prev.fetchKey) }))
                }
                options={PROVIDER_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              />
            </Field>
          )}
          <Field label="نام نمایشی">
            <Input value={form.label} onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))} />
          </Field>
          <Field label="کلید دریافت (fetch key)">
            <Input value={form.fetchKey} onChange={(e) => handleFetchKeyChange(e.target.value, form.provider)} disabled={fetchKeyLocked} dir="ltr" />
          </Field>
          {adding && (
            <Field label="شناسه (slug)">
              <Input value={form.slug} onChange={(e) => setForm((prev) => ({ ...prev, slug: e.target.value.trim().toLowerCase() }))} dir="ltr" />
            </Field>
          )}
          <div className="flex gap-2">
            <Button className="flex-1" loading={isSaving} onClick={() => void (adding ? saveNew() : saveEdit())}>
              ذخیره
            </Button>
            <Button variant="secondary" disabled={isSaving} onClick={cancelForm}>
              انصراف
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
