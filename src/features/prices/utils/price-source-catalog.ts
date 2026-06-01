import { DEFAULT_PRICE_SOURCES, type PriceSource } from '@/features/prices/constants/price-sources';
import { supabase } from '@/shared/lib/supabase/client';
import type { PriceSourceRecord } from '@/shared/types/domain';

export function recordToPriceSource(record: PriceSourceRecord): PriceSource {
  return {
    slug: record.slug,
    provider: record.provider,
    label: record.label,
    fetchKey: record.fetch_key ?? undefined,
    updatesRate: record.updates_rate,
    deprecated: record.deprecated,
  };
}

export function recordsToCatalog(records: PriceSourceRecord[]): PriceSource[] {
  return records.map(recordToPriceSource);
}

export function defaultRecordsForUser(userId: string): PriceSourceRecord[] {
  const now = new Date().toISOString();
  return DEFAULT_PRICE_SOURCES.map((source) => ({
    user_id: userId,
    slug: source.slug,
    provider: source.provider,
    label: source.label,
    fetch_key: source.fetchKey ?? null,
    updates_rate: source.updatesRate,
    deprecated: source.deprecated ?? false,
    is_builtin: true,
    created_at: now,
    updated_at: now,
  }));
}

/** Seed built-in catalog when a user has none (e.g. new account before migration). */
export async function ensureDefaultPriceSources(
  userId: string
): Promise<PriceSourceRecord[]> {
  const { data: existing, error: readError } = await supabase
    .from('price_sources')
    .select('slug')
    .eq('user_id', userId)
    .limit(1);

  if (readError) throw readError;
  if ((existing?.length ?? 0) > 0) return [];

  const rows = defaultRecordsForUser(userId);
  const { data, error } = await supabase
    .from('price_sources')
    .upsert(rows, { onConflict: 'user_id,slug', ignoreDuplicates: true })
    .select();

  if (error) throw error;

  const now = new Date().toISOString();
  const settingsRows = rows.map((row) => ({
    user_id: userId,
    slug: row.slug,
    conversion_rate: 1,
    usd_factor: 'none' as const,
    updated_at: now,
  }));

  await supabase
    .from('price_source_settings')
    .upsert(settingsRows, { onConflict: 'user_id,slug', ignoreDuplicates: true });

  return (data as PriceSourceRecord[]) || rows;
}

export interface ApiQuoteSource {
  slug: string;
  provider: PriceSource['provider'];
  fetchKey?: string;
}

export function catalogToApiSources(catalog: readonly PriceSource[]): ApiQuoteSource[] {
  return catalog
    .filter((source) => !!source.fetchKey)
    .map((source) => ({
      slug: source.slug,
      provider: source.provider,
      fetchKey: source.fetchKey,
    }));
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9._-]*$/.test(slug);
}

export function suggestSlug(provider: PriceSource['provider'], fetchKey: string): string {
  const normalized = fetchKey.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '_');
  return `${provider}.${normalized || 'custom'}`;
}
