import type { Currency, CurrencyRate } from '@/shared/types/domain';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';
import type { RateHistories } from '@/shared/utils/rate-history';

export type WalletRateSource = 'base' | 'saved' | 'history' | 'missing';

/**
 * Toman per unit for valuing a wallet NOW.
 *   IRT → 1 · saved rate (`currency_rates`) · else the newest rate in the
 *   history (last known) · else 0 and `missing` so the UI can warn.
 */
export function walletRateNow(
  currency: Currency,
  currencyRates: CurrencyRate[],
  histories: RateHistories | null
): { rate: number; source: WalletRateSource } {
  if (currency === 'IRT') return { rate: 1, source: 'base' };
  const saved = tomanPerUnit(currency, currencyRates);
  if (saved > 0) return { rate: saved, source: 'saved' };
  const last = histories?.[currency]?.latest() ?? null;
  if (last && last > 0) return { rate: last, source: 'history' };
  return { rate: 0, source: 'missing' };
}
