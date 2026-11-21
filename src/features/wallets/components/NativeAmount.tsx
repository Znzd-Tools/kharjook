import { Amount, type AmountProps } from '@/design-system';
import type { Currency } from '@/shared/types/domain';
import { CURRENCY_META } from '@/features/wallets/constants/currency-meta';

/** An amount in its own currency (wallet or person): Toman, $, ₺ or €. */
export function NativeAmount({ currency, ...props }: Omit<AmountProps, 'currency'> & { currency: Currency }) {
  if (currency === 'IRT') return <Amount {...props} />;
  if (currency === 'USD') return <Amount {...props} currency="USD" />;
  return (
    <span className="inline-flex items-baseline gap-1" dir="rtl">
      <Amount {...props} hideUnit fractionDigits={props.fractionDigits ?? 2} />
      <span className="text-micro text-fg-muted">{CURRENCY_META[currency].symbol}</span>
    </span>
  );
}
