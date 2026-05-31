'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, RefreshCw } from 'lucide-react';
import { FormattedNumberInput } from '@/shared/components/FormattedNumberInput';
import { useToast } from '@/shared/components/Toast';
import { supabase } from '@/shared/lib/supabase/client';
import type { PriceSourceSetting, PriceSourceUsdFactor } from '@/shared/types/domain';
import { useAuth, useData } from '@/features/portfolio/PortfolioProvider';
import { PRICE_SOURCES } from '@/features/prices/constants/price-sources';

type LocalRow = {
  conversion_rate: string;
  usd_factor: PriceSourceUsdFactor;
};

const FETCHABLE_SOURCES = PRICE_SOURCES.filter((source) => !!source.fetchKey);

const USD_FACTOR_OPTIONS: { value: PriceSourceUsdFactor; label: string }[] = [
  { value: 'none', label: 'بدون دلار' },
  { value: 'multiply', label: '× دلار' },
  { value: 'divide', label: '÷ دلار' },
];

function buildLocal(settings: PriceSourceSetting[]): Record<string, LocalRow> {
  const bySlug = new Map(settings.map((row) => [row.slug, row]));
  const out: Record<string, LocalRow> = {};

  for (const source of FETCHABLE_SOURCES) {
    const row = bySlug.get(source.slug);
    out[source.slug] = {
      conversion_rate: row ? String(row.conversion_rate) : '1',
      usd_factor:
        row?.usd_factor === 'multiply' || row?.usd_factor === 'divide'
          ? row.usd_factor
          : 'none',
    };
  }

  return out;
}

export function PriceSourceSettingsView() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { priceSourceSettings, setPriceSourceSettings } = useData();

  const initial = useMemo(
    () => buildLocal(priceSourceSettings),
    [priceSourceSettings]
  );
  const [local, setLocal] = useState<Record<string, LocalRow>>(initial);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocal(buildLocal(priceSourceSettings));
  }, [priceSourceSettings]);

  if (!user) return null;

  const setConversionRate = (slug: string, canonical: string) =>
    setLocal((prev) => ({
      ...prev,
      [slug]: { ...prev[slug]!, conversion_rate: canonical },
    }));

  const setUsdFactor = (slug: string, usd_factor: PriceSourceUsdFactor) =>
    setLocal((prev) => ({
      ...prev,
      [slug]: { ...prev[slug]!, usd_factor },
    }));

  const handleSave = async () => {
    const now = new Date().toISOString();
    const rows: PriceSourceSetting[] = [];

    for (const source of FETCHABLE_SOURCES) {
      const row = local[source.slug];
      if (!row) continue;

      const raw = row.conversion_rate.trim();
      const conversion_rate = raw === '' || raw === '.' ? 1 : Number(raw);
      if (!Number.isFinite(conversion_rate) || conversion_rate <= 0) {
        toast.error(`ضریب تبدیل نامعتبر برای «${source.label}».`);
        return;
      }

      rows.push({
        user_id: user.id,
        slug: source.slug,
        conversion_rate,
        usd_factor: row.usd_factor,
        updated_at: now,
      });
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from('price_source_settings')
        .upsert(rows, { onConflict: 'user_id,slug' })
        .select();
      if (error) throw error;

      const fresh = (data as PriceSourceSetting[]) || [];
      setPriceSourceSettings((prev) => {
        const map = new Map(prev.map((row) => [row.slug, row]));
        fresh.forEach((row) => map.set(row.slug, row));
        return Array.from(map.values());
      });

      toast.success('تنظیم منابع قیمت ذخیره شد.');
      router.back();
    } catch (err) {
      console.error(err);
      toast.error('خطا در ذخیره تنظیم منابع قیمت.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#0F1015] min-h-full pb-24 animate-in slide-in-from-right-8 duration-300 relative">
      <div className="sticky top-0 bg-[#161722]/90 backdrop-blur-md px-6 py-4 flex items-center gap-4 border-b border-white/5 z-20">
        <button
          onClick={() => router.back()}
          className="p-2 -mr-2 bg-white/5 rounded-full text-slate-300 hover:bg-white/10"
        >
          <ArrowRight size={20} />
        </button>
        <h2 className="text-lg font-bold text-white flex-1">تنظیم منابع قیمت</h2>
      </div>

      <div className="px-6 pt-4">
        <p className="text-xs text-slate-500 leading-5">
          پس از دریافت قیمت از منبع: مقدار خام × ضریب تبدیل، سپس در صورت انتخاب ×
          یا ÷ نرخ دلار (تومان). مثال: ضریب ۱۰۰۰ برای تبدیل واحد؛ ضریب ۱٫۲ و ×
          دلار برای قیمت دلاری.
        </p>
      </div>

      <div className="p-6 space-y-3">
        {FETCHABLE_SOURCES.map((source) => {
          const row = local[source.slug] ?? {
            conversion_rate: '1',
            usd_factor: 'none' as const,
          };

          return (
            <div
              key={source.slug}
              className="bg-[#1A1B26] p-4 rounded-2xl border border-white/5 space-y-3"
            >
              <p className="text-slate-200 text-sm font-medium">{source.label}</p>

              <div className="space-y-1.5">
                <p className="text-[11px] text-slate-500">ضریب تبدیل</p>
                <FormattedNumberInput
                  value={row.conversion_rate}
                  onValueChange={(canonical) => setConversionRate(source.slug, canonical)}
                  className="w-full bg-[#222436] border border-white/10 rounded-xl p-3 text-white text-sm outline-none focus:border-cyan-500 text-left"
                  dir="ltr"
                  placeholder="1"
                />
              </div>

              <div className="space-y-1.5">
                <p className="text-[11px] text-slate-500">نرخ دلار</p>
                <div className="grid grid-cols-3 gap-2">
                  {USD_FACTOR_OPTIONS.map((option) => {
                    const active = row.usd_factor === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setUsdFactor(source.slug, option.value)}
                        className={`rounded-xl py-2 text-xs font-medium transition-colors ${
                          active
                            ? 'bg-cyan-600 text-white'
                            : 'bg-[#222436] text-slate-400 border border-white/5 hover:text-slate-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="fixed bottom-6 right-1/2 translate-x-1/2 w-[calc(100%-3rem)] max-w-100 bg-cyan-600 hover:bg-cyan-500 text-white p-4 rounded-2xl font-bold shadow-[0_4px_20px_rgba(8,145,178,0.4)] transition-all flex justify-center items-center gap-2 z-30 disabled:opacity-50"
      >
        {isSaving ? (
          <RefreshCw className="animate-spin" size={20} />
        ) : (
          'ذخیره تنظیمات'
        )}
      </button>
    </div>
  );
}
