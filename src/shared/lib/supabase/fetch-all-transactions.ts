import type { SupabaseClient } from '@supabase/supabase-js';
import type { Transaction } from '@/shared/types/domain';

/** PostgREST returns at most `max_rows` (1000) rows per request. */
const PAGE_SIZE = 1000;

/**
 * Every transaction of one user, paged past the 1000-row API limit.
 *
 * A plain `.select('*')` silently stops at 1000 rows, so balances, holdings
 * and P/L built from it are wrong for users with more rows. Ordered by
 * `created_at, id` so pages never repeat or skip a row (rows inserted in one
 * statement share `created_at`).
 *
 * Returns `{ data }` like a Supabase query, so it drops into `Promise.all`.
 */
export async function fetchAllUserTransactions(
  admin: SupabaseClient,
  userId: string
): Promise<{ data: Transaction[] | null; error: Error | null }> {
  const rows: Transaction[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await admin
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    const page = (data ?? []) as Transaction[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { data: rows, error: null };
  }
}
