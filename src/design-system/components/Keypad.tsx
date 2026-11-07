'use client';

import { Delete } from '../icons';
import { cn } from '../lib/cn';
import { haptic } from '../lib/haptics';

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '.' | '000' | 'backspace';

export interface KeypadProps {
  /** Canonical value (ASCII digits + optional dot). */
  value: string;
  onValueChange: (value: string) => void;
  /** Allow a decimal point (USD, gold grams). Default false. */
  allowDecimal?: boolean;
  /** Max decimal places. Default 2. */
  maxFractionDigits?: number;
  /** Max integer digits. Default 15. */
  maxIntegerDigits?: number;
  className?: string;
}

const FA = '۰۱۲۳۴۵۶۷۸۹';

/** Apply one key press to a canonical number string. Pure — easy to test. */
export function applyKey(
  value: string,
  key: KeypadKey,
  { allowDecimal = false, maxFractionDigits = 2, maxIntegerDigits = 15 } = {}
): string {
  if (key === 'backspace') return value.slice(0, -1);
  const [int = '', frac] = value.split('.');
  if (key === '.') {
    if (!allowDecimal || value.includes('.')) return value;
    return (value || '0') + '.';
  }
  if (frac !== undefined) {
    if (key === '000') return value;
    if (frac.length >= maxFractionDigits) return value;
    return value + key;
  }
  if (value === '' && (key === '0' || key === '000')) return value;
  const next = int + key;
  if (next.length > maxIntegerDigits) return value;
  return next;
}

/**
 * In-app numeric keypad for the amount-first add flow. Faster than the
 * system keyboard and never covers the save button.
 */
export function Keypad({ value, onValueChange, allowDecimal = false, maxFractionDigits, maxIntegerDigits, className }: KeypadProps) {
  const keys: KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', allowDecimal ? '.' : '000', '0', 'backspace'];
  const press = (k: KeypadKey) => {
    haptic('light');
    onValueChange(applyKey(value, k, { allowDecimal, maxFractionDigits, maxIntegerDigits }));
  };
  return (
    <div className={cn('grid grid-cols-3 gap-2', className)} dir="ltr" role="group" aria-label="صفحه‌کلید عددی">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => press(k)}
          onContextMenu={(e) => {
            if (k === 'backspace') {
              e.preventDefault();
              onValueChange('');
            }
          }}
          aria-label={k === 'backspace' ? 'پاک کردن' : k === '.' ? 'ممیز' : k}
          className={cn(
            'ds-focus flex h-14 items-center justify-center rounded-full text-headline font-semibold text-fg select-none',
            'transition-[background-color,transform] duration-(--ds-duration-instant) hover:bg-hover active:scale-95 active:bg-pressed',
            '[&_svg]:size-6'
          )}
        >
          {k === 'backspace' ? <Delete /> : k === '.' ? '٫' : k.replace(/\d/g, (d) => FA[Number(d)]!)}
        </button>
      ))}
    </div>
  );
}
