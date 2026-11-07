import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';
import { formatMoney, type Currency } from '../lib/format';

export const amountVariants = cva('inline-flex items-baseline gap-1 tabular whitespace-nowrap', {
  variants: {
    size: {
      hero: 'text-display font-extrabold [&_[data-unit]]:text-callout [&_[data-unit]]:font-medium',
      lg: 'text-headline font-extrabold [&_[data-unit]]:text-caption [&_[data-unit]]:font-medium',
      md: 'text-body font-semibold [&_[data-unit]]:text-micro [&_[data-unit]]:font-normal',
      sm: 'text-callout font-medium [&_[data-unit]]:text-micro [&_[data-unit]]:font-normal',
      xs: 'text-caption font-medium [&_[data-unit]]:text-micro [&_[data-unit]]:font-normal',
    },
  },
  defaultVariants: { size: 'md' },
});

export type AmountTone = 'auto' | 'default' | 'muted' | 'positive' | 'negative' | 'inherit';

const TONE: Record<Exclude<AmountTone, 'auto'>, string> = {
  inherit: '',
  default: 'text-fg',
  muted: 'text-fg-muted',
  positive: 'text-positive-ink',
  negative: 'text-negative-ink',
};

export interface AmountProps extends VariantProps<typeof amountVariants> {
  value: number;
  currency?: Currency;
  /**
   * `auto`: green for > 0, red for < 0. Use only for changes
   * (income/expense, PnL) — not for balances.
   */
  tone?: AmountTone;
  /** Show + on positive values. */
  signed?: boolean;
  /** ۱۲٫۵ میلیون instead of ۱۲٬۵۰۰٬۰۰۰. */
  compact?: boolean;
  /** Hide the number (privacy mode). */
  hidden?: boolean;
  /** Hide the unit text. */
  hideUnit?: boolean;
  fractionDigits?: number;
  className?: string;
}

/**
 * Money display. The single source for amount formatting:
 * Persian digits, real minus sign, unit in smaller type, tabular figures.
 */
export function Amount({
  value,
  currency = 'TOMAN',
  tone = 'default',
  signed,
  compact,
  hidden,
  hideUnit,
  fractionDigits,
  size,
  className,
}: AmountProps) {
  const m = formatMoney(value, { currency, signed, compact, fractionDigits });
  const resolved = tone === 'auto' ? (value > 0 ? 'positive' : value < 0 ? 'negative' : 'muted') : tone;
  const unit = hideUnit ? null : (
    <span data-unit className="opacity-70">
      {m.unit}
    </span>
  );
  return (
    <span className={cn(amountVariants({ size }), TONE[resolved], className)} aria-label={hidden ? 'مبلغ پنهان' : m.text}>
      <span aria-hidden className="inline-flex items-baseline gap-1" dir="rtl">
        {hidden ? (
          <span className="tracking-widest">••••••</span>
        ) : (
          <>
            {m.unitFirst && unit}
            <span dir="ltr">
              {m.sign}
              {m.number}
            </span>
            {!m.unitFirst && unit}
          </>
        )}
      </span>
    </span>
  );
}
