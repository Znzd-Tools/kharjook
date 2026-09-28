'use client';

import { useMemo } from 'react';
import { useData } from '@/features/portfolio/PortfolioProvider';
import { buildRateHistories, type RateHistories } from '@/shared/utils/rate-history';
import { useRateHistoryContext } from '@/features/rates/components/RateHistoryProvider';

/**
 * Historical Toman rates (USD / EUR / TRY) for any date, rebuilt from the
 * user's own data. See `rate-history.ts` for sources and interpolation.
 */
export function useRateHistories(): RateHistories {
  const shared = useRateHistoryContext();
  const { transactions, dailyPrices, currencyRates, wallets } = useData();
  // Outside the provider (tests / isolated renders) build it locally.
  const local = useMemo(
    () =>
      shared ? null : buildRateHistories({ transactions, dailyPrices, currencyRates, wallets }),
    [shared, transactions, dailyPrices, currencyRates, wallets]
  );
  return shared ?? local!;
}

/**
 * USD rate to use for a row dated `date`:
 *   - today or later → `currentRate` (unchanged behavior for normal entry)
 *   - a past date    → the history estimate for that date
 *   - no history     → `currentRate`
 */
export function usdRateOn(
  histories: RateHistories,
  date: string,
  todayStr: string,
  currentRate: number
): number {
  if (!date || date >= todayStr) return currentRate;
  const r = histories.USD.at(date);
  return r && r > 0 ? r : currentRate;
}
