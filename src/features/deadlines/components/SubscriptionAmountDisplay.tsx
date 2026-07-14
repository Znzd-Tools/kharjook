'use client';

import type { Currency, CurrencyMode, CurrencyRate } from '@/shared/types/domain';
import {
  formatSubscriptionConvertedLabel,
  formatSubscriptionNativeAmount,
} from '@/features/deadlines/utils/subscription-amount-display';

export function SubscriptionAmountDisplay({
  amount,
  currency,
  currencyRates,
  currencyMode,
  usdRate,
  primaryClassName = 'text-slate-200',
  secondaryClassName = 'text-[10px] text-slate-500 mt-0.5',
  align = 'start',
}: {
  amount: number;
  currency: Currency;
  currencyRates: CurrencyRate[];
  currencyMode: CurrencyMode;
  usdRate: number;
  primaryClassName?: string;
  secondaryClassName?: string;
  align?: 'start' | 'end';
}) {
  const showNative = currency !== 'IRT';

  return (
    <div className={align === 'end' ? 'text-left' : undefined} dir="ltr">
      <p className={primaryClassName}>
        {formatSubscriptionConvertedLabel(
          amount,
          currency,
          currencyMode,
          currencyRates,
          usdRate
        )}
      </p>
      {showNative && (
        <p className={secondaryClassName}>
          {formatSubscriptionNativeAmount(amount, currency)}
        </p>
      )}
    </div>
  );
}
