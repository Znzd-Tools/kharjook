import type { Currency, CurrencyRate } from '@/shared/types/domain';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';

/** Toman per one unit of a wallet currency. */
export const moneyRate = (currency: Currency, rates: CurrencyRate[], usdRate: number) =>
  currency === 'IRT' ? 1 : currency === 'USD' && usdRate > 0 ? usdRate : tomanPerUnit(currency, rates);
