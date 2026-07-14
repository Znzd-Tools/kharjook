import { CURRENCY_META } from '@/features/wallets/constants/currency-meta';
import type { Currency, CurrencyMode, CurrencyRate } from '@/shared/types/domain';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';
import { formatCurrency, formatCurrencyAmount } from '@/shared/utils/format-currency';

export function subscriptionAmountToToman(
  amount: number,
  currency: Currency,
  currencyRates: CurrencyRate[]
): number {
  const rate = tomanPerUnit(currency, currencyRates);
  if (!(rate > 0)) return 0;
  return amount * rate;
}

export function subscriptionConvertedAmount(
  amount: number,
  currency: Currency,
  currencyMode: CurrencyMode,
  currencyRates: CurrencyRate[],
  usdRate: number
): number {
  const toman = subscriptionAmountToToman(amount, currency, currencyRates);
  if (!(toman > 0)) return amount;
  if (currencyMode === 'USD' && usdRate > 0) return toman / usdRate;
  return toman;
}

/** Amount as entered in the subscription form (wallet currency). */
export function formatSubscriptionNativeAmount(amount: number, currency: Currency): string {
  const meta = CURRENCY_META[currency];
  return `${meta.symbol} ${formatCurrencyAmount(amount, currency)}`;
}

export function formatSubscriptionConvertedLabel(
  amount: number,
  currency: Currency,
  currencyMode: CurrencyMode,
  currencyRates: CurrencyRate[],
  usdRate: number
): string {
  const converted = subscriptionConvertedAmount(
    amount,
    currency,
    currencyMode,
    currencyRates,
    usdRate
  );
  return formatCurrency(converted, currencyMode);
}
