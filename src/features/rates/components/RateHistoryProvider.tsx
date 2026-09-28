'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import { useAuth, useData } from '@/features/portfolio/PortfolioProvider';
import {
  buildRateHistories,
  derivedHistoryRows,
  type RateHistories,
  type RateHistoryRow,
} from '@/shared/utils/rate-history';
import { seedDerivedRateHistory } from '@/shared/utils/rate-history-store';

const RateHistoryContext = createContext<RateHistories | null>(null);

/**
 * Builds the rate history once for the whole app:
 *  - loads saved rows from `currency_rate_history` (manual / provider days)
 *  - merges them with what can be rebuilt from snapshots and transactions
 *  - once per session, saves the rebuilt days (never overwriting saved ones)
 *    so server jobs (bot, recurring, settle) can use the same history.
 * If the table is missing, it silently works from the rebuilt data only.
 */
export function RateHistoryProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { transactions, dailyPrices, currencyRates, wallets, isLoadingData } = useData();
  const [savedHistory, setSavedHistory] = useState<RateHistoryRow[]>([]);
  const seededFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('currency_rate_history')
          .select('currency, date_string, toman_per_unit, source')
          .eq('user_id', user.id)
          .neq('source', 'derived');
        if (!cancelled && !error && data) setSavedHistory(data as RateHistoryRow[]);
      } catch {
        // Table not migrated yet — rebuilt history only.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, currencyRates]);

  const histories = useMemo(
    () => buildRateHistories({ transactions, dailyPrices, currencyRates, wallets, savedHistory }),
    [transactions, dailyPrices, currencyRates, wallets, savedHistory]
  );

  useEffect(() => {
    if (!user || isLoadingData || transactions.length === 0) return;
    if (seededFor.current === user.id) return;
    seededFor.current = user.id;
    void seedDerivedRateHistory(supabase, user.id, derivedHistoryRows(histories));
  }, [user, isLoadingData, transactions.length, histories]);

  return <RateHistoryContext.Provider value={histories}>{children}</RateHistoryContext.Provider>;
}

export function useRateHistoryContext(): RateHistories | null {
  return useContext(RateHistoryContext);
}
