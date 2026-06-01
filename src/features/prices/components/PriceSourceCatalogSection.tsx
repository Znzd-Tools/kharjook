'use client';

import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/shared/components/Toast';
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
  const toast = useToast();
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
        <p className="text-xs font-medium text-slate-400">منابع قیمت</p>
        {!showForm && (
          <button
            type="button"
            onClick={startAdd}
            className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
          >
            <Plus size={14} />
            افزودن
          </button>
        )}
      </div>

      <p className="text-xs text-slate-500 leading-5">
        ارائه‌دهنده (آبان‌تتر / زرپی) ثابت است؛ نام، کلید دریافت و شناسه را می‌توانی
        سفارشی کنی.
      </p>

      <div className="space-y-2">
        {visibleSources.map((source) => (
          <div
            key={source.slug}
            className="flex items-start gap-2 bg-[#222436] border border-white/5 rounded-xl p-3"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate">{source.label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5" dir="ltr">
                {source.slug} · {source.provider} · {source.fetch_key}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => startEdit(source)}
                className="text-[11px] text-slate-400 hover:text-white px-2 py-1"
              >
                ویرایش
              </button>
              {!source.is_builtin && (
                <button
                  type="button"
                  onClick={() => void removeSource(source)}
                  disabled={isSaving}
                  className="text-rose-400/80 hover:text-rose-300 p-1 disabled:opacity-50"
                  aria-label="حذف"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div className="bg-[#222436] border border-white/10 rounded-2xl p-4 space-y-3">
          <p className="text-sm text-slate-200">
            {adding ? 'منبع جدید' : 'ویرایش منبع'}
          </p>

          {adding && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-slate-500">ارائه‌دهنده</p>
              <div className="grid grid-cols-2 gap-2">
                {PROVIDER_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        provider: option.value,
                        slug: suggestSlug(option.value, prev.fetchKey),
                      }))
                    }
                    className={`rounded-xl py-2 text-xs font-medium ${
                      form.provider === option.value
                        ? 'bg-cyan-600 text-white'
                        : 'bg-[#1A1B26] text-slate-400 border border-white/5'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <p className="text-[11px] text-slate-500">نام نمایشی</p>
            <input
              value={form.label}
              onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
              className="w-full bg-[#1A1B26] border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-cyan-500"
            />
          </div>

          <div className="space-y-1.5">
            <p className="text-[11px] text-slate-500">کلید دریافت (fetch key)</p>
            <input
              value={form.fetchKey}
              onChange={(e) =>
                handleFetchKeyChange(e.target.value, form.provider)
              }
              disabled={fetchKeyLocked}
              className="w-full bg-[#1A1B26] border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-cyan-500 disabled:opacity-60"
              dir="ltr"
            />
          </div>

          {adding && (
            <div className="space-y-1.5">
              <p className="text-[11px] text-slate-500">شناسه (slug)</p>
              <input
                value={form.slug}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    slug: e.target.value.trim().toLowerCase(),
                  }))
                }
                className="w-full bg-[#1A1B26] border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-cyan-500"
                dir="ltr"
              />
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => void (adding ? saveNew() : saveEdit())}
              disabled={isSaving}
              className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl py-2.5 text-sm font-medium disabled:opacity-50"
            >
              {isSaving ? 'در حال ذخیره...' : 'ذخیره'}
            </button>
            <button
              type="button"
              onClick={cancelForm}
              disabled={isSaving}
              className="px-4 bg-[#1A1B26] border border-white/10 text-slate-300 rounded-xl py-2.5 text-sm disabled:opacity-50"
            >
              انصراف
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
