'use client';

import { recordRateHistory } from '@/shared/utils/rate-history-store';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AmountField, Banner, Button, Disclosure, EmptyState, Field, IconButton, Input, Section, Text } from '@/design-system';
import { RefreshCw, TrendingUp } from '@/design-system/icons';
import { formatCanonicalNumberDisplay, parseFormattedNumberToCanonical } from '@/shared/utils/format-number-input';
import { useToast } from '@/shared/components/Toast';
import { supabase } from '@/shared/lib/supabase/client';
import type { CurrencyRate, DailyPrice, RateCurrency } from '@/shared/types/domain';
import { useAuth, useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { formatJalaali, todayJalaali, todayJalaaliInTimezone } from '@/shared/utils/jalali';
import { calculateAssetStats } from '@/shared/utils/calculate-asset-stats';
import {
  fetchProviderQuotesDetailed,
  mergeGlobalUsdDollarQuotes,
} from '@/features/prices/utils/provider-refresh';
import {
  applyConversionRatesToQuotes,
  buildConversionConfigMap,
} from '@/features/prices/utils/conversion-rate';
import { catalogToApiSources } from '@/features/prices/utils/price-source-catalog';
import {
  boundFetchablePriceSourceSlugs,
  PriceSourceAdvancedSection,
  usePriceSourceAdvancedSave,
} from '@/features/prices/components/PriceSourceAdvancedSection';
import { PriceSourceCatalogSection } from '@/features/prices/components/PriceSourceCatalogSection';
import {
  CURRENCY_META,
  RATE_ORDER,
} from '@/features/wallets/constants/currency-meta';
import { evaluateAutoPriceHealth } from '@/features/prices/utils/auto-price-health';

type LocalPrices = Record<string, { toman: string; usd: string }>;
type LocalRates = Partial<Record<RateCurrency, string>>;
const USD_RATE_SOURCE_SLUG = 'abantether.usdt';

const toTomanInput = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '';
  return String(Math.round(value));
};

const toUsdInput = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) return '';
  return value.toFixed(2);
};

const buildOtherRatesLocal = (
  rates: CurrencyRate[],
  currencies: RateCurrency[]
): LocalRates => {
  const out: LocalRates = {};
  for (const c of currencies) {
    const found = rates.find((r) => r.currency === c);
    out[c] = found ? String(found.toman_per_unit) : '';
  }
  return out;
};

export function DailyPricesView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { user } = useAuth();
  const {
    assets,
    wallets,
    transactions,
    currencyRates,
    setAssets,
    setCurrencyRates,
    setDailyPrices,
    priceSourceSettings,
    priceSourceCatalog,
    dailyPrices,
  } = useData();
  const { usdRate } = useUI();

  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshingProviders, setIsRefreshingProviders] = useState(false);
  const [localPrices, setLocalPrices] = useState<LocalPrices>({});
  const [localUsd, setLocalUsd] = useState<string>(() =>
    usdRate ? String(usdRate) : ''
  );
  const [advancedOpen, setAdvancedOpen] = useState(
    () => searchParams.get('advanced') === '1'
  );

  const boundSlugs = useMemo(
    () =>
      boundFetchablePriceSourceSlugs(
        assets.map((a) => a.price_source_id),
        priceSourceCatalog
      ),
    [assets, priceSourceCatalog]
  );
  const priceSourceControl = usePriceSourceAdvancedSave(boundSlugs);

  const otherCurrencies = useMemo(() => {
    const used = new Set<RateCurrency>();
    for (const wallet of wallets) {
      if (wallet.currency !== 'IRT' && wallet.currency !== 'USD') {
        used.add(wallet.currency as RateCurrency);
      }
    }
    return RATE_ORDER.filter((c) => c !== 'USD' && used.has(c));
  }, [wallets]);

  const [localOtherRates, setLocalOtherRates] = useState<LocalRates>(() =>
    buildOtherRatesLocal(currencyRates, otherCurrencies)
  );

  useEffect(() => {
    const p: LocalPrices = {};
    assets.forEach((a) => {
      p[a.id] = {
        toman: toTomanInput(Number(a.price_toman)),
        usd: toUsdInput(Number(a.price_usd)),
      };
    });
    setLocalPrices(p);
  }, [assets]);

  useEffect(() => {
    setLocalUsd(usdRate ? String(usdRate) : '');
  }, [usdRate]);

  useEffect(() => {
    setLocalOtherRates(buildOtherRatesLocal(currencyRates, otherCurrencies));
  }, [currencyRates, otherCurrencies]);

  const currentUsdNum = Number(localUsd);
  const effectiveUsd =
    Number.isFinite(currentUsdNum) && currentUsdNum > 0 ? currentUsdNum : 0;

  const refreshableAssets = assets.filter((asset) => !!asset.price_source_id);
  const todayStr = useMemo(() => formatJalaali(todayJalaali()), []);
  const autoPriceHealth = useMemo(
    () => evaluateAutoPriceHealth({ assets, dailyPrices, todayStr }),
    [assets, dailyPrices, todayStr]
  );
  const visibleAssets = useMemo(
    () =>
      assets.filter((asset) => {
        if (asset.include_in_balance === false) return false;
        const stats = calculateAssetStats(asset, transactions, 'TOMAN', usdRate);
        return stats.totalAmount > 0;
      }),
    [assets, transactions, usdRate]
  );

  const applyProviderQuotes = async () => {
    const slugs = [
      USD_RATE_SOURCE_SLUG,
      ...refreshableAssets
        .map((asset) => asset.price_source_id)
        .filter((slug): slug is string => !!slug),
    ];

    const result = await fetchProviderQuotesDetailed(
      slugs,
      catalogToApiSources(priceSourceCatalog)
    );
    const quotesRaw = result.quotes;
    const usdQuoteFromFetch = quotesRaw.find((quote) => quote.slug === USD_RATE_SOURCE_SLUG);
    const nextUsdRate =
      usdQuoteFromFetch && usdQuoteFromFetch.priceToman > 0
        ? usdQuoteFromFetch.priceToman
        : effectiveUsd;

    const quotes = applyConversionRatesToQuotes(
      mergeGlobalUsdDollarQuotes(quotesRaw, refreshableAssets, nextUsdRate),
      buildConversionConfigMap(priceSourceSettings),
      nextUsdRate
    );
    if (quotes.length === 0) {
      return {
        updatedAssetCount: 0,
        failedProviders: result.failedProviders,
        unresolvedSlugs: result.unresolvedSlugs,
        unknownRequestedSlugs: result.unknownRequestedSlugs,
      };
    }

    const quoteBySlug = new Map(quotes.map((quote) => [quote.slug, quote]));

    if (usdQuoteFromFetch && usdQuoteFromFetch.priceToman > 0) {
      setLocalUsd(String(usdQuoteFromFetch.priceToman));
    }

    setLocalPrices((prev) => {
      const next = { ...prev };
      for (const asset of refreshableAssets) {
        const slug = asset.price_source_id;
        if (!slug) continue;
        const quote = quoteBySlug.get(slug);
        if (!quote) continue;
        next[asset.id] = {
          toman: toTomanInput(quote.priceToman),
          usd:
            nextUsdRate > 0
              ? toUsdInput(quote.priceToman / nextUsdRate)
              : (next[asset.id]?.usd ?? ''),
        };
      }
      return next;
    });

    return {
      updatedAssetCount: quotes.filter((quote) => quote.slug !== USD_RATE_SOURCE_SLUG).length,
      failedProviders: result.failedProviders,
      unresolvedSlugs: result.unresolvedSlugs,
      unknownRequestedSlugs: result.unknownRequestedSlugs,
    };
  };

  const handleRefreshProviders = async (silent = false) => {
    setIsRefreshingProviders(true);
    try {
      const refresh = await applyProviderQuotes();
      if (!silent) {
        if (refresh.updatedAssetCount > 0) {
          toast.success(`${refresh.updatedAssetCount} قیمت دارایی و نرخ دلار بروزرسانی شد.`);
        } else {
          toast.info('قیمت معتبری برای بروزرسانی دریافت نشد.');
        }
        if (refresh.failedProviders.length > 0 || refresh.unresolvedSlugs.length > 0 || refresh.unknownRequestedSlugs.length > 0) {
          const providerMsg = refresh.failedProviders
            .map((p) => `${p.provider}: ${p.error}`)
            .join(' | ');
          const unresolvedMsg = refresh.unresolvedSlugs
            .map((u) => `${u.slug}: ${u.reason}`)
            .join(' | ');
          const unknownMsg = refresh.unknownRequestedSlugs.join(', ');
          const detail = [providerMsg, unresolvedMsg, unknownMsg ? `unknown: ${unknownMsg}` : '']
            .filter(Boolean)
            .join(' | ');
          toast.error(`بخشی از بروزرسانی انجام نشد. ${detail}`, { duration: 10000 });
        }
      }
    } catch (error) {
      if (!silent) {
        const detail = error instanceof Error ? error.message : String(error);
        toast.error(`دریافت قیمت از منبع بیرونی ناموفق بود. ${detail}`, {
          duration: 14_000,
        });
      }
      console.error(error);
    } finally {
      setIsRefreshingProviders(false);
    }
  };

  const handlePriceChange = (
    id: string,
    field: 'toman' | 'usd',
    canonical: string
  ) => {
    setLocalPrices((prev) => {
      const current = prev[id] || { toman: '', usd: '' };
      let newToman = current.toman;
      let newUsd = current.usd;

      if (field === 'toman') {
        newToman = canonical;
        const n = Number(canonical);
        if (
          canonical !== '' &&
          canonical !== '.' &&
          !Number.isNaN(n) &&
          effectiveUsd > 0
        ) {
          newUsd = toUsdInput(n / effectiveUsd);
        }
      } else {
        newUsd = canonical;
        const n = Number(canonical);
        if (canonical !== '' && canonical !== '.' && !Number.isNaN(n)) {
          newToman = toTomanInput(n * effectiveUsd);
        }
      }
      return { ...prev, [id]: { toman: newToman, usd: newUsd } };
    });
  };

  const handleUsdRateChange = (canonical: string) => {
    setLocalUsd(canonical);
    const newUsd =
      canonical === '' || canonical === '.' ? 0 : Number(canonical);
    if (canonical !== '' && canonical !== '.' && Number.isNaN(newUsd)) return;

    setLocalPrices((prev) => {
      const next: LocalPrices = { ...prev };
      for (const id of Object.keys(next)) {
        const row = next[id]!;
        const u = Number(row.usd);
        if (row.usd !== '' && !Number.isNaN(u)) {
          next[id] = { ...row, toman: toTomanInput(u * newUsd) };
        }
      }
      return next;
    });
  };

  const handleSavePrices = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      for (const c of otherCurrencies) {
        const raw = localOtherRates[c]?.trim();
        if (!raw) continue;
        const n = Number(raw);
        if (!Number.isFinite(n) || n <= 0) {
          toast.error(`نرخ نامعتبر برای ${CURRENCY_META[c].label}.`);
          return;
        }
      }

      const assetUpdates = assets.map((a) => ({
        id: a.id,
        user_id: a.user_id,
        category_id: a.category_id,
        name: a.name,
        unit: a.unit,
        decimal_places: a.decimal_places,
        price_toman: Number(localPrices[a.id]?.toman || 0),
        price_usd: Number(localPrices[a.id]?.usd || 0),
        icon_url: a.icon_url,
        price_source_id: a.price_source_id,
        include_in_profit_loss: a.include_in_profit_loss ?? true,
        include_in_balance: a.include_in_balance ?? true,
      }));

      const usdNum = Number(localUsd);
      const now = new Date().toISOString();
      const rateRows: {
        user_id: string;
        currency: RateCurrency;
        toman_per_unit: number;
        updated_at: string;
      }[] = [];

      if (Number.isFinite(usdNum) && usdNum > 0) {
        rateRows.push({
          user_id: user.id,
          currency: 'USD',
          toman_per_unit: usdNum,
          updated_at: now,
        });
      }

      for (const c of otherCurrencies) {
        const raw = localOtherRates[c]?.trim();
        if (!raw) continue;
        rateRows.push({
          user_id: user.id,
          currency: c,
          toman_per_unit: Number(raw),
          updated_at: now,
        });
      }

      const assetPromise = supabase.from('assets').upsert(assetUpdates).select();
      const ratePromise =
        rateRows.length > 0
          ? supabase
              .from('currency_rates')
              .upsert(rateRows, { onConflict: 'user_id,currency' })
              .select()
          : null;

      const [assetRes, rateRes] = await Promise.all([assetPromise, ratePromise]);

      if (assetRes.error) throw assetRes.error;
      if (rateRes?.error) throw rateRes.error;

      if (rateRows.length > 0) {
        // Keep a dated copy for historical conversions (best-effort).
        const todayRateDate = formatJalaali(todayJalaaliInTimezone('Asia/Tehran'));
        await Promise.all(
          rateRows.map((r) =>
            recordRateHistory(supabase, user.id, r.currency, todayRateDate, r.toman_per_unit, 'manual')
          )
        );
      }

      const priceSourceOk = await priceSourceControl.save();
      if (!priceSourceOk) return;

      setAssets((assetRes.data as typeof assets) || []);

      if (rateRes) {
        const fresh = (rateRes.data as CurrencyRate[]) || [];
        setCurrencyRates((prev) => {
          const map = new Map(prev.map((r) => [r.currency, r]));
          fresh.forEach((r) => map.set(r.currency, r));
          return Array.from(map.values());
        });
      }

      const today = formatJalaali(todayJalaali());
      const snapshotPayload: Omit<DailyPrice, 'created_at' | 'updated_at'>[] =
        assetUpdates
          .filter((a) => a.price_toman > 0 && a.price_usd >= 0)
          .map((a) => ({
            user_id: user.id,
            asset_id: a.id,
            date_string: today,
            price_toman: a.price_toman,
            price_usd: a.price_usd,
            source: 'manual' as const,
          }));

      if (snapshotPayload.length > 0) {
        const { data: dpData, error: dpErr } = await supabase
          .from('daily_prices')
          .upsert(snapshotPayload, { onConflict: 'user_id,asset_id,date_string' })
          .select();

        if (dpErr) {
          console.error('daily_prices upsert failed', dpErr);
          toast.info('قیمت‌ها ذخیره شد؛ اما ثبت تاریخچه‌ی روزانه ناموفق بود.');
        } else {
          const fresh = (dpData as DailyPrice[]) || [];
          setDailyPrices((prev) => {
            const key = (p: DailyPrice) =>
              `${p.user_id}|${p.asset_id}|${p.date_string}`;
            const map = new Map(prev.map((p) => [key(p), p]));
            for (const p of fresh) map.set(key(p), p);
            return Array.from(map.values());
          });
        }
      }

      toast.success('قیمت‌ها و نرخ‌ها ذخیره شد.');
      router.back();
    } catch (error) {
      toast.error('خطا در ذخیره.');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5 px-(--ds-gutter) pt-1 pb-32">
      {refreshableAssets.length > 0 && (
        <Banner tone={autoPriceHealth.isHealthy ? 'positive' : 'warning'}>
          {autoPriceHealth.isHealthy
            ? `قیمت خودکار ${autoPriceHealth.syncedTodayCount.toLocaleString('fa-IR')} دارایی امروز رسید (هر روز حدود ۰۹:۰۰).`
            : `قیمت خودکار ${autoPriceHealth.missingTodayCount.toLocaleString('fa-IR')} از ${autoPriceHealth.autoAssetCount.toLocaleString('fa-IR')} دارایی امروز نرسید. دکمه بروزرسانی را بزن یا منبع قیمت را بررسی کن.`}
        </Banner>
      )}

      <Section
        title="نرخ ارزها"
        action={
          <IconButton
            size="sm"
            variant="ghost"
            aria-label="refresh-provider-prices"
            title="بروزرسانی قیمت‌ها از منبع"
            icon={<RefreshCw className={isRefreshingProviders ? 'animate-spin' : undefined} />}
            disabled={isRefreshingProviders}
            onClick={() => void handleRefreshProviders()}
          />
        }
      >
        <div className="space-y-4 rounded-card bg-panel p-4">
          <Field label="نرخ دلار">
            <AmountField aria-label="نرخ دلار" value={localUsd} onValueChange={handleUsdRateChange} />
          </Field>
          {otherCurrencies.map((c) => {
            const meta = CURRENCY_META[c];
            return (
              <Field key={c} label={`${meta.label} (${meta.symbol})`}>
                <AmountField
                  aria-label={`نرخ ${meta.label}`}
                  value={localOtherRates[c] ?? ''}
                  onValueChange={(canonical) => setLocalOtherRates((prev) => ({ ...prev, [c]: canonical }))}
                />
              </Field>
            );
          })}
          <Text variant="caption" tone="subtle">
            قیمت زنده با دکمه‌ی بروزرسانی یا کشیدن صفحه‌ی خانه به پایین می‌رسد.
          </Text>
        </div>
      </Section>

      <Section title="قیمت دارایی‌ها">
        {visibleAssets.length === 0 ? (
          <div className="rounded-card bg-panel">
            <EmptyState compact icon={<TrendingUp />} title="دارایی با موجودی بیشتر از صفر نیست" />
          </div>
        ) : (
          <div className="space-y-2">
            {visibleAssets.map((asset) => (
              <div key={asset.id} className="space-y-3 rounded-card bg-panel p-4">
                <Text variant="callout" weight="semibold">
                  {asset.name}
                </Text>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="تومان">
                    <AmountField
                      aria-label={`قیمت ${asset.name} به تومان`}
                      value={localPrices[asset.id]?.toman || ''}
                      onValueChange={(v) => handlePriceChange(asset.id, 'toman', v)}
                      showWords={false}
                    />
                  </Field>
                  <Field label="دلار">
                    <Input
                      aria-label={`قیمت ${asset.name} به دلار`}
                      inputMode="decimal"
                      dir="ltr"
                      startAdornment="$"
                      value={formatCanonicalNumberDisplay(localPrices[asset.id]?.usd || '')}
                      onChange={(e) => handlePriceChange(asset.id, 'usd', parseFormattedNumberToCanonical(e.target.value))}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <div className="rounded-card bg-panel px-4">
        <Disclosure title="تنظیمات پیشرفته" open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <div className="space-y-6 pb-4">
            <PriceSourceCatalogSection />
            <div className="space-y-3 border-t border-line pt-4">
              <Text variant="caption" tone="muted" weight="medium">
                ضرایب تبدیل
              </Text>
              <PriceSourceAdvancedSection slugs={boundSlugs} control={priceSourceControl} />
            </div>
          </div>
        </Disclosure>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(var(--ds-tabbar-height)+env(safe-area-inset-bottom,0px))] z-30 mx-auto max-w-(--ds-max-width) bg-canvas/90 px-(--ds-gutter) pt-3 pb-3 backdrop-blur-md">
        <Button size="lg" fullWidth loading={isSaving} onClick={handleSavePrices}>
          ذخیره
        </Button>
      </div>
    </div>
  );
}
