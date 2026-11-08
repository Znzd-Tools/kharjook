'use client';

import { useCallback } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import type { DailyPrice, Transaction } from '@/shared/types/domain';
import { useAuth, useData } from '@/features/portfolio/PortfolioProvider';
import { buildTradeSnapshots } from '@/features/transactions/utils/transaction-form-logic';

/**
 * Best-effort snapshot of BUY/SELL trades into `daily_prices`.
 *
 * Source-priority contract: manual > trade > auto (higher never gets
 * overwritten by lower). Check-then-upsert on the client:
 *   1. Build candidate rows from the saved txs.
 *   2. Drop any (asset_id, date_string) that already has a MANUAL row.
 *   3. Dedupe per (asset_id, date_string), last occurrence wins.
 *   4. Upsert (overwrites prior trade/auto rows — correct for edits).
 * Failures are logged and never abort the main save.
 *
 * Moved unchanged from AddTransactionView so the v1 and v2 add screens
 * share one copy.
 */
export function useTradeSnapshots() {
  const { user } = useAuth();
  const { dailyPrices, setDailyPrices } = useData();

  return useCallback(
    async (txs: Transaction[]) => {
      if (!user) return;
      const candidates = buildTradeSnapshots(txs, user.id);
      if (candidates.length === 0) return;

      const manualKeys = new Set(
        dailyPrices.filter((p) => p.source === 'manual').map((p) => `${p.asset_id}|${p.date_string}`)
      );

      const byKey = new Map<string, Omit<DailyPrice, 'created_at' | 'updated_at'>>();
      for (const row of candidates) {
        const key = `${row.asset_id}|${row.date_string}`;
        if (manualKeys.has(key)) continue;
        byKey.set(key, row); // last wins
      }
      const rows = [...byKey.values()];
      if (rows.length === 0) return;

      const { data, error } = await supabase
        .from('daily_prices')
        .upsert(rows, { onConflict: 'user_id,asset_id,date_string' })
        .select();
      if (error) {
        console.error('daily_prices trade snapshot failed', error);
        return;
      }
      const fresh = (data as DailyPrice[]) || [];
      if (fresh.length === 0) return;
      setDailyPrices((prev) => {
        const key = (p: DailyPrice) => `${p.user_id}|${p.asset_id}|${p.date_string}`;
        const map = new Map(prev.map((p) => [key(p), p]));
        for (const p of fresh) map.set(key(p), p);
        return Array.from(map.values());
      });
    },
    [user, dailyPrices, setDailyPrices]
  );
}
