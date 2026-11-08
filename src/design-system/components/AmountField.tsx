'use client';

import { useId } from 'react';
import {
  formatCanonicalNumberDisplay,
  parseFormattedNumberToCanonical,
} from '@/shared/utils/format-number-input';
import { cn } from '../lib/cn';
import { formatMoney, toPersianDigits, type Currency } from '../lib/format';
import { useField } from './Field';

export interface AmountFieldProps {
  /** Canonical value: ASCII digits and one optional dot. "" = empty. */
  value: string;
  onValueChange: (canonical: string) => void;
  currency?: Currency;
  /** `hero`: big centered amount (add-transaction screen). */
  size?: 'md' | 'hero';
  placeholder?: string;
  /** Override the unit text (e.g. "گرم" for an asset quantity). Hides the words line. */
  unitLabel?: string;
  /** Show words under the number ("۱٫۲ میلیون تومان"). Default true. */
  showWords?: boolean;
  autoFocus?: boolean;
  /** Use with `Keypad`: hide the system keyboard. */
  readOnly?: boolean;
  className?: string;
  'aria-label'?: string;
}

/**
 * Money input with thousand grouping and a readable compact hint.
 * Long toman numbers are hard to read — the hint prevents
 * zero-count mistakes.
 */
export function AmountField({
  value,
  onValueChange,
  currency = 'TOMAN',
  unitLabel,
  size = 'md',
  placeholder = '۰',
  showWords = true,
  autoFocus,
  readOnly,
  className,
  ...props
}: AmountFieldProps) {
  const field = useField();
  const autoId = useId();
  const id = field?.id ?? autoId;
  // Persian digits on screen; the parser accepts both digit sets.
  const display = toPersianDigits(formatCanonicalNumberDisplay(value));
  const num = Number(value || 0);
  const words = !unitLabel && value && num >= 1000 ? formatMoney(num, { currency, compact: true }).text : null;
  const unit = unitLabel ?? (currency === 'USD' ? 'دلار' : 'تومان');

  if (size === 'hero') {
    return (
      <div className={cn('flex flex-col items-center gap-1 py-4', className)}>
        <div className="flex items-baseline gap-2" dir="ltr">
          <input
            id={id}
            inputMode="decimal"
            autoComplete="off"
            autoFocus={autoFocus}
            readOnly={readOnly}
            value={display}
            placeholder={placeholder}
            onChange={(e) => onValueChange(parseFormattedNumberToCanonical(e.target.value))}
            aria-label={props['aria-label'] ?? 'مبلغ'}
            aria-invalid={field?.invalid || undefined}
            className="field-sizing-content min-w-[2ch] max-w-full bg-transparent text-center text-[2.75rem] leading-none font-extrabold text-fg tabular caret-accent outline-none placeholder:text-fg-disabled"
          />
        </div>
        <span className="text-callout text-fg-subtle">{unit}</span>
        {showWords && <span className="h-5 text-caption text-accent-ink">{words}</span>}
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div className="flex h-12 w-full items-center gap-2 rounded-control border border-transparent bg-sunken px-3.5 transition-colors focus-within:border-accent has-[[aria-invalid=true]]:border-negative">
        <input
          id={id}
          dir="ltr"
          inputMode="decimal"
          autoComplete="off"
          autoFocus={autoFocus}
          readOnly={readOnly}
          value={display}
          placeholder={placeholder}
          onChange={(e) => onValueChange(parseFormattedNumberToCanonical(e.target.value))}
          aria-label={props['aria-label']}
          aria-invalid={field?.invalid || undefined}
          aria-describedby={field?.errorId ?? field?.descriptionId}
          className="h-full min-w-0 flex-1 bg-transparent text-end text-body font-semibold text-fg tabular outline-none placeholder:text-fg-disabled"
        />
        <span className="shrink-0 text-caption text-fg-subtle">{unit}</span>
      </div>
      {showWords && words && <span className="px-1 text-caption text-accent-ink">{words}</span>}
    </div>
  );
}
