import type { SupabaseClient } from '@supabase/supabase-js';
import type { RateCurrency } from '@/shared/types/domain';
import { jalaliDayNumber, type RateHistoryRow } from '@/shared/utils/rate-history';

/**
 * Read / write `currency_rate_history`. Every function is best-effort: if
 * the table does not exist yet (migration not applied) or a call fails, it
 * returns null / does nothing, so callers keep their old behavior.
 */

export type RateHistorySource = 'manual' | 'provider' | 'derived';

/** Save today's rate (manual edit or provider refresh). Overwrites that day. */
export async function recordRateHistory(
  client: SupabaseClient,
  userId: string,
  currency: RateCurrency,
  dateString: string,
  tomanPerUnit: number,
  source: Exclude<RateHistorySource, 'derived'>
): Promise<void> {
  if (!(tomanPerUnit > 0)) return;
  try {
    // A provider refresh must not overwrite a manual value of the same day.
    if (source === 'provider') {
      const { data } = await client
        .from('currency_rate_history')
        .select('source')
        .eq('user_id', userId)
        .eq('currency', currency)
        .eq('date_string', dateString)
        .maybeSingle();
      if (data && (data as { source: string }).source === 'manual') return;
    }
    await client.from('currency_rate_history').upsert(
      {
        user_id: userId,
        currency,
        date_string: dateString,
        toman_per_unit: tomanPerUnit,
        source,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,currency,date_string' }
    );
  } catch (err) {
    console.warn('currency_rate_history write skipped', err);
  }
}

/** Seed derived estimates; never overwrites an existing day. */
export async function seedDerivedRateHistory(
  client: SupabaseClient,
  userId: string,
  rows: RateHistoryRow[]
): Promise<void> {
  if (rows.length === 0) return;
  try {
    const payload = rows.map((r) => ({
      user_id: userId,
      currency: r.currency,
      date_string: r.date_string,
      toman_per_unit: r.toman_per_unit,
      source: 'derived' as const,
    }));
    for (let i = 0; i < payload.length; i += 500) {
      const { error } = await client
        .from('currency_rate_history')
        .upsert(payload.slice(i, i + 500), {
          onConflict: 'user_id,currency,date_string',
          ignoreDuplicates: true,
        });
      if (error) return; // table missing or no permission — stay silent
    }
  } catch (err) {
    console.warn('currency_rate_history seed skipped', err);
  }
}

/**
 * Estimated rate on `dateString` from stored history: the exact day, else
 * straight-line interpolation between the nearest days before and after,
 * else the nearest single day. null when nothing is stored (or on error).
 */
export async function loadRateAt(
  client: SupabaseClient,
  userId: string,
  currency: RateCurrency,
  dateString: string
): Promise<number | null> {
  try {
    const [before, after] = await Promise.all([
      client
        .from('currency_rate_history')
        .select('date_string, toman_per_unit')
        .eq('user_id', userId)
        .eq('currency', currency)
        .lte('date_string', dateString)
        .order('date_string', { ascending: false })
        .limit(1)
        .maybeSingle(),
      client
        .from('currency_rate_history')
        .select('date_string, toman_per_unit')
        .eq('user_id', userId)
        .eq('currency', currency)
        .gte('date_string', dateString)
        .order('date_string', { ascending: true })
        .limit(1)
        .maybeSingle(),
    ]);
    if (before.error || after.error) return null;
    type Row = { date_string: string; toman_per_unit: number };
    const b = before.data as Row | null;
    const a = after.data as Row | null;
    if (!b && !a) return null;
    if (b && !a) return Number(b.toman_per_unit) || null;
    if (a && !b) return Number(a.toman_per_unit) || null;
    const bd = jalaliDayNumber(b!.date_string);
    const ad = jalaliDayNumber(a!.date_string);
    const td = jalaliDayNumber(dateString);
    const br = Number(b!.toman_per_unit);
    const ar = Number(a!.toman_per_unit);
    if (bd === null || ad === null || td === null || ad === bd) return br || ar || null;
    return br + (ar - br) * ((td - bd) / (ad - bd));
  } catch {
    return null;
  }
}

/**
 * USD rate for a row dated `dateString` on the server: today/future → the
 * current rate; a past date → stored history; nothing stored → current rate.
 */
export async function serverUsdRateOn(
  client: SupabaseClient,
  userId: string,
  dateString: string,
  todayStr: string,
  currentRate: number
): Promise<number> {
  if (!dateString || dateString >= todayStr) return currentRate;
  const hist = await loadRateAt(client, userId, 'USD', dateString);
  return hist && hist > 0 ? hist : currentRate;
}
