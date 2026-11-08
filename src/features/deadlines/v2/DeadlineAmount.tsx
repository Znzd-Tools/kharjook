'use client';

import { Amount } from '@/design-system';
import { CURRENCY_META } from '@/features/wallets/constants/currency-meta';
import { useData } from '@/features/portfolio/PortfolioProvider';
import type { Currency } from '@/shared/types/domain';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';

/**
 * A deadline amount in its own currency (Toman, $, ₺, €). Lira and Euro
 * also show the Toman value when a rate exists. Never shows ₺ as Toman.
 */
export function DeadlineAmount({
  value,
  currency,
  size = 'sm',
  hidden,
}: {
  value: number;
  currency: Currency;
  size?: 'xs' | 'sm';
  hidden?: boolean;
}) {
  const { currencyRates } = useData();
  if (currency === 'IRT' || currency === 'USD')
    return <Amount value={value} currency={currency === 'USD' ? 'USD' : 'TOMAN'} size={size} compact hidden={hidden} />;
  const meta = CURRENCY_META[currency];
  const rate = tomanPerUnit(currency, currencyRates);
  const native = value.toLocaleString('fa-IR', { maximumFractionDigits: meta.decimals });
  if (hidden) return <Amount value={value} size={size} hidden />;
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span className={size === 'xs' ? 'tabular text-caption text-fg' : 'tabular text-callout text-fg'} dir="ltr">
        {meta.symbol} {native}
      </span>
      {rate > 0 && (
        <span className="text-micro text-fg-subtle">
          ≈ <Amount value={value * rate} size="xs" compact tone="inherit" />
        </span>
      )}
    </span>
  );
}

/** Toman value of a deadline (0 when the rate is missing). */
export function deadlineToman(value: number, currency: Currency, rates: Parameters<typeof tomanPerUnit>[1]) {
  return value * tomanPerUnit(currency, rates);
}
