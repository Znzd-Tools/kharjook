'use client';

import { supabase } from '@/shared/lib/supabase/client';
import type { ApiQuoteSource } from '@/features/prices/utils/price-source-catalog';
import {
  mergeById,
  mergeCurrencyRates,
  mergeDailyPrices,
  mergeGlobalUsdDollarQuotes,
  type ProviderQuote,
  type ProviderQuoteFetchResult,
} from '@/features/prices/utils/provider-quote-utils';
import { formatJalaali, todayJalaali } from '@/shared/utils/jalali';
import type {
  Asset,
  CurrencyRate,
  DailyPrice,
  RateCurrency,
} from '@/shared/types/domain';

export type { ProviderQuote, ProviderQuoteFetchResult };
export { mergeById, mergeCurrencyRates, mergeDailyPrices, mergeGlobalUsdDollarQuotes };

interface FetchProviderQuotesResponse {
  quotes: ProviderQuote[];
  failedProviders?: Array<{ provider: string; error: string }>;
  unresolvedSlugs?: Array<{ slug: string; reason: string }>;
  unknownRequestedSlugs?: string[];
}

interface PersistProviderQuotesInput {
  userId: string;
  assets: Asset[];
  dailyPrices: DailyPrice[];
  usdRate: number;
  quotes: ProviderQuote[];
}

interface PersistProviderQuotesResult {
  assets: Asset[];
  dailyPrices: DailyPrice[];
}

export async function fetchProviderQuotes(
  slugs: string[],
  sources?: ApiQuoteSource[]
): Promise<ProviderQuote[]> {
  const result = await fetchProviderQuotesDetailed(slugs, sources);
  return result.quotes;
}

export async function fetchProviderQuotesDetailed(
  slugs: string[],
  sources?: ApiQuoteSource[]
): Promise<ProviderQuoteFetchResult> {
  const uniqueSlugs = Array.from(new Set(slugs.filter(Boolean)));
  if (uniqueSlugs.length === 0) {
    return {
      quotes: [],
      failedProviders: [],
      unresolvedSlugs: [],
      unknownRequestedSlugs: [],
    };
  }

  const quotesUrl =
    typeof window !== 'undefined' && window.location?.origin
      ? `${window.location.origin}/api/prices/quotes`
      : '/api/prices/quotes';

  const requestInit: RequestInit = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    credentials: 'omit',
    cache: 'no-store',
    body: JSON.stringify({
      slugs: uniqueSlugs,
      ...(sources && sources.length > 0 ? { sources } : {}),
    }),
  };

  const doFetch = () => fetch(quotesUrl, requestInit);

  let response: Response;
  try {
    response = await doFetch();
  } catch {
    await new Promise((r) => setTimeout(r, 700));
    response = await doFetch();
  }

  let raw = await response.text();
  if (!response.ok && response.status >= 502 && response.status <= 504) {
    await new Promise((r) => setTimeout(r, 600));
    response = await doFetch();
    raw = await response.text();
  }

  if (!response.ok) {
    const hint = raw.slice(0, 400).trim() || '(empty body)';
    throw new Error(`درخواست قیمت ناموفق (${response.status}): ${hint}`);
  }

  let payload: FetchProviderQuotesResponse;
  try {
    payload = JSON.parse(raw) as FetchProviderQuotesResponse;
  } catch {
    throw new Error(
      `پاسخ سرور JSON نبود (احتمالاً خطای میزبان یا پروکسی). شروع پاسخ: ${raw.slice(0, 160).trim()}`
    );
  }

  return {
    quotes: Array.isArray(payload.quotes) ? payload.quotes : [],
    failedProviders: Array.isArray(payload.failedProviders) ? payload.failedProviders : [],
    unresolvedSlugs: Array.isArray(payload.unresolvedSlugs) ? payload.unresolvedSlugs : [],
    unknownRequestedSlugs: Array.isArray(payload.unknownRequestedSlugs) ? payload.unknownRequestedSlugs : [],
  };
}

export async function persistCurrencyRate(
  userId: string,
  currency: RateCurrency,
  tomanPerUnit: number
): Promise<CurrencyRate[]> {
  const { data, error } = await supabase
    .from('currency_rates')
    .upsert(
      [
        {
          user_id: userId,
          currency,
          toman_per_unit: tomanPerUnit,
          updated_at: new Date().toISOString(),
        },
      ],
      { onConflict: 'user_id,currency' }
    )
    .select();

  if (error) throw error;
  return (data as CurrencyRate[]) || [];
}

export async function persistProviderQuotes({
  userId,
  assets,
  dailyPrices,
  usdRate,
  quotes,
}: PersistProviderQuotesInput): Promise<PersistProviderQuotesResult> {
  const quoteBySlug = new Map(quotes.map((quote) => [quote.slug, quote]));

  const assetUpdates = assets
    .filter((asset) => !!asset.price_source_id && quoteBySlug.has(asset.price_source_id))
    .map((asset) => {
      const quote = quoteBySlug.get(asset.price_source_id!)!;
      return {
        id: asset.id,
        user_id: asset.user_id,
        category_id: asset.category_id,
        name: asset.name,
        unit: asset.unit,
        price_toman: quote.priceToman,
        price_usd: usdRate > 0 ? quote.priceToman / usdRate : 0,
        include_in_profit_loss: asset.include_in_profit_loss ?? true,
        include_in_balance: asset.include_in_balance ?? true,
      };
    });

  if (assetUpdates.length === 0) {
    return { assets: [], dailyPrices: [] };
  }

  const { data: assetRows, error: assetError } = await supabase
    .from('assets')
    .upsert(assetUpdates)
    .select();

  if (assetError) throw assetError;

  const today = formatJalaali(todayJalaali());
  const snapshotByAssetId = new Map(
    dailyPrices
      .filter((price) => price.date_string === today)
      .map((price) => [price.asset_id, price])
  );

  const snapshotPayload = assetUpdates
    .filter((asset) => {
      const existing = snapshotByAssetId.get(asset.id);
      return !existing || existing.source === 'auto';
    })
    .map((asset) => ({
      user_id: userId,
      asset_id: asset.id,
      date_string: today,
      price_toman: asset.price_toman,
      price_usd: asset.price_usd,
      source: 'auto' as const,
    }));

  if (snapshotPayload.length === 0) {
    return {
      assets: (assetRows as Asset[]) || [],
      dailyPrices: [],
    };
  }

  const { data: dailyPriceRows, error: dailyPriceError } = await supabase
    .from('daily_prices')
    .upsert(snapshotPayload, {
      onConflict: 'user_id,asset_id,date_string',
    })
    .select();

  if (dailyPriceError) throw dailyPriceError;

  return {
    assets: (assetRows as Asset[]) || [],
    dailyPrices: (dailyPriceRows as DailyPrice[]) || [],
  };
}
