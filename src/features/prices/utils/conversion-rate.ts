import type { PriceSourceSetting } from '@/shared/types/domain';
import type { ProviderQuote } from '@/features/prices/utils/provider-refresh';

export const DEFAULT_CONVERSION_RATE = 1;

export function buildConversionRateMap(
  settings: Pick<PriceSourceSetting, 'slug' | 'conversion_rate'>[]
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of settings) {
    const rate = Number(row.conversion_rate);
    if (Number.isFinite(rate) && rate > 0) {
      map.set(row.slug, rate);
    }
  }
  return map;
}

export function conversionRateForSlug(
  slug: string,
  rates: Map<string, number>
): number {
  const rate = rates.get(slug);
  if (rate === undefined || !Number.isFinite(rate) || rate <= 0) {
    return DEFAULT_CONVERSION_RATE;
  }
  return rate;
}

export function applyConversionRatesToQuotes(
  quotes: ProviderQuote[],
  rates: Map<string, number>
): ProviderQuote[] {
  return quotes.map((quote) => {
    const factor = conversionRateForSlug(quote.slug, rates);
    if (factor === DEFAULT_CONVERSION_RATE) return quote;
    return {
      ...quote,
      priceToman: quote.priceToman * factor,
    };
  });
}
