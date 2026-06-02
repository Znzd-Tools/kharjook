import { APP_GLOBAL_USD_SLUG } from '@/features/prices/constants/price-sources';
import type { CurrencyRate, DailyPrice } from '@/shared/types/domain';

export interface ProviderQuote {
  slug: string;
  provider: string;
  priceToman: number;
  fetchedAt: string;
}

export interface ProviderQuoteFetchResult {
  quotes: ProviderQuote[];
  failedProviders: Array<{ provider: string; error: string }>;
  unresolvedSlugs: Array<{ slug: string; reason: string }>;
  unknownRequestedSlugs: string[];
}

export function mergeById<T extends { id: string }>(prev: T[], next: T[]): T[] {
  if (next.length === 0) return prev;
  const map = new Map(prev.map((item) => [item.id, item]));
  for (const item of next) map.set(item.id, item);
  return Array.from(map.values());
}

export function mergeDailyPrices(prev: DailyPrice[], next: DailyPrice[]): DailyPrice[] {
  if (next.length === 0) return prev;
  const keyOf = (price: DailyPrice) =>
    `${price.user_id}|${price.asset_id}|${price.date_string}`;
  const map = new Map(prev.map((price) => [keyOf(price), price]));
  for (const price of next) map.set(keyOf(price), price);
  return Array.from(map.values());
}

export function mergeCurrencyRates(
  prev: CurrencyRate[],
  next: CurrencyRate[]
): CurrencyRate[] {
  if (next.length === 0) return prev;
  const map = new Map(prev.map((rate) => [rate.currency, rate]));
  for (const rate of next) map.set(rate.currency, rate);
  return Array.from(map.values());
}

/** Ensures app.dollar quote exists when any asset uses {@link APP_GLOBAL_USD_SLUG}. */
export function mergeGlobalUsdDollarQuotes(
  quotes: ProviderQuote[],
  assets: { price_source_id?: string | null }[],
  usdTomanPerUnit: number
): ProviderQuote[] {
  if (!(usdTomanPerUnit > 0)) return quotes;
  const needs = assets.some((a) => a.price_source_id === APP_GLOBAL_USD_SLUG);
  if (!needs) return quotes;

  const merged = quotes.filter((q) => q.slug !== APP_GLOBAL_USD_SLUG);
  merged.push({
    slug: APP_GLOBAL_USD_SLUG,
    provider: 'app',
    priceToman: usdTomanPerUnit,
    fetchedAt: new Date().toISOString(),
  });
  return merged;
}
