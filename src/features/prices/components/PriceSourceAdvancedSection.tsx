'use client';

import { useEffect, useMemo, useState } from 'react';
import { FormattedNumberInput } from '@/shared/components/FormattedNumberInput';
import { useToast } from '@/shared/components/Toast';
import { supabase } from '@/shared/lib/supabase/client';
import type { PriceSourceSetting, PriceSourceUsdFactor } from '@/shared/types/domain';
import { useAuth, useData } from '@/features/portfolio/PortfolioProvider';
import { findPriceSourceInCatalog } from '@/features/prices/constants/price-sources';

type LocalRow = {
  conversion_rate: string;
  usd_factor: PriceSourceUsdFactor;
};

const USD_FACTOR_OPTIONS: { value: PriceSourceUsdFactor; label: string }[] = [
  { value: 'none', label: 'بدون دلار' },
  { value: 'multiply', label: '× دلار' },
  { value: 'divide', label: '÷ دلار' },
];

function buildLocal(
  settings: PriceSourceSetting[],
  slugs: string[]
): Record<string, LocalRow> {
  const bySlug = new Map(settings.map((row) => [row.slug, row]));
  const out: Record<string, LocalRow> = {};

  for (const slug of slugs) {
    const row = bySlug.get(slug);
    out[slug] = {
      conversion_rate: row ? String(row.conversion_rate) : '1',
      usd_factor:
        row?.usd_factor === 'multiply' || row?.usd_factor === 'divide'
          ? row.usd_factor
          : 'none',
    };
  }

  return out;
}

export interface PriceSourceAdvancedSectionProps {
  /** When set, only these slugs are shown. Defaults to slugs bound on user assets. */
  slugs?: string[];
  /** Called after a successful save so the parent can stay on the same page. */
  onSaved?: () => void;
  /** When true, renders an inline save button. When false, exposes save via ref/imperative — use embeddedSave. */
  embeddedSave?: boolean;
}

export function usePriceSourceAdvancedSave(slugs: string[]) {
  const toast = useToast();
  const { user } = useAuth();
  const { priceSourceSettings, setPriceSourceSettings, priceSourceCatalog } = useData();
  const [local, setLocal] = useState<Record<string, LocalRow>>(() =>
    buildLocal(priceSourceSettings, slugs)
  );

  useEffect(() => {
    setLocal(buildLocal(priceSourceSettings, slugs));
  }, [priceSourceSettings, slugs]);

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

  const save = async (): Promise<boolean> => {
    if (!user) return false;

    const now = new Date().toISOString();
    const rows: PriceSourceSetting[] = [];

    for (const slug of slugs) {
      const source = findPriceSourceInCatalog(slug, priceSourceCatalog);
      if (!source?.fetchKey) continue;

      const row = local[slug];
      if (!row) continue;

      const raw = row.conversion_rate.trim();
      const conversion_rate = raw === '' || raw === '.' ? 1 : Number(raw);
      if (!Number.isFinite(conversion_rate) || conversion_rate <= 0) {
        toast.error(`ضریب تبدیل نامعتبر برای «${source.label}».`);
        return false;
      }

      rows.push({
        user_id: user.id,
        slug,
        conversion_rate,
        usd_factor: row.usd_factor,
        updated_at: now,
      });
    }

    if (rows.length === 0) return true;

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

    return true;
  };

  return { local, slugs, setConversionRate, setUsdFactor, save };
}

export type PriceSourceAdvancedControl = ReturnType<
  typeof usePriceSourceAdvancedSave
>;

function useResolvedSlugs(slugsProp?: string[]) {
  const { assets, priceSourceCatalog } = useData();
  return useMemo(() => {
    if (slugsProp) return slugsProp;
    return boundFetchablePriceSourceSlugs(
      assets.map((asset) => asset.price_source_id),
      priceSourceCatalog
    );
  }, [slugsProp, assets, priceSourceCatalog]);
}

function PriceSourceAdvancedSectionInner({
  slugs,
  control,
  embeddedSave = false,
  onSaved,
}: {
  slugs: string[];
  control: PriceSourceAdvancedControl;
  embeddedSave?: boolean;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const { priceSourceCatalog } = useData();
  const { local, setConversionRate, setUsdFactor, save } = control;

  const sources = slugs
    .map((slug) => findPriceSourceInCatalog(slug, priceSourceCatalog))
    .filter((s): s is NonNullable<typeof s> => !!s);

  if (sources.length === 0) {
    return (
      <p className="text-xs text-slate-500 leading-5">
        هیچ دارایی با منبع قیمت خودکار نداری. پس از اتصال منبع به یک دارایی،
        تنظیمات پیشرفته اینجا نمایش داده می‌شود.
      </p>
    );
  }

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const ok = await save();
      if (ok) {
        toast.success('تنظیمات منابع قیمت ذخیره شد.');
        onSaved?.();
      }
    } catch (err) {
      console.error(err);
      toast.error('خطا در ذخیره تنظیم منابع قیمت.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 leading-5">
        فقط برای منابعی که به دارایی‌هایت متصل‌اند. معمولاً نیازی به تغییر
        نیست.
      </p>

      {sources.map((source) => {
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
                onValueChange={(canonical) =>
                  setConversionRate(source.slug, canonical)
                }
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

      {embeddedSave && (
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="w-full bg-[#222436] hover:bg-[#2a2c40] border border-white/10 text-slate-200 p-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          {isSaving ? 'در حال ذخیره...' : 'ذخیره تنظیمات پیشرفته'}
        </button>
      )}
    </div>
  );
}

function PriceSourceAdvancedSectionStateful(
  props: PriceSourceAdvancedSectionProps & { slugs: string[] }
) {
  const control = usePriceSourceAdvancedSave(props.slugs);
  return (
    <PriceSourceAdvancedSectionInner
      slugs={props.slugs}
      control={control}
      embeddedSave={props.embeddedSave}
      onSaved={props.onSaved}
    />
  );
}

export function PriceSourceAdvancedSection({
  slugs: slugsProp,
  embeddedSave = false,
  onSaved,
  control,
}: PriceSourceAdvancedSectionProps & {
  control?: PriceSourceAdvancedControl;
}) {
  const slugs = useResolvedSlugs(slugsProp);

  if (control) {
    return (
      <PriceSourceAdvancedSectionInner
        slugs={slugs}
        control={control}
        embeddedSave={embeddedSave}
        onSaved={onSaved}
      />
    );
  }

  return (
    <PriceSourceAdvancedSectionStateful
      slugs={slugs}
      embeddedSave={embeddedSave}
      onSaved={onSaved}
    />
  );
}

/** Slugs with fetch keys that are bound to at least one asset. */
export function boundFetchablePriceSourceSlugs(
  assetPriceSourceIds: (string | null | undefined)[],
  catalog: readonly { slug: string; fetchKey?: string; deprecated?: boolean }[]
): string[] {
  const bound = new Set<string>();
  for (const id of assetPriceSourceIds) {
    if (id) bound.add(id);
  }
  return Array.from(bound).filter((slug) => {
    const source = catalog.find((s) => s.slug === slug);
    return !!source?.fetchKey && !source.deprecated;
  });
}
