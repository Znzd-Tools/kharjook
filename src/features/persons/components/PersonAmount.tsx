import { Amount, type AmountProps } from '@/design-system';
import type { Currency } from '@/shared/types/domain';
import { CURRENCY_META } from '@/features/wallets/constants/currency-meta';

/** A balance or amount with a person, in that person's own currency. */
export function PersonAmount({ currency, ...props }: Omit<AmountProps, 'currency'> & { currency: Currency }) {
  if (currency === 'IRT') return <Amount {...props} />;
  if (currency === 'USD') return <Amount {...props} currency="USD" />;
  return (
    <span className="inline-flex items-baseline gap-1" dir="rtl">
      <Amount {...props} hideUnit fractionDigits={props.fractionDigits ?? 2} />
      <span className="text-micro text-fg-muted">{CURRENCY_META[currency].symbol}</span>
    </span>
  );
}
