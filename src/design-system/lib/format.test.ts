import { describe, expect, it } from 'vitest';
import { formatMoney, formatPercent } from './format';
import { cn } from './cn';

describe('formatMoney', () => {
  it('formats toman with Persian digits and grouping', () => {
    expect(formatMoney(1250000).text).toBe('۱٬۲۵۰٬۰۰۰ تومان');
  });
  it('uses a real minus sign for negatives', () => {
    expect(formatMoney(-500).sign).toBe('−');
  });
  it('adds plus sign only when signed', () => {
    expect(formatMoney(10, { signed: true }).sign).toBe('+');
    expect(formatMoney(10).sign).toBe('');
  });
  it('compacts large numbers', () => {
    expect(formatMoney(12_500_000, { compact: true }).text).toBe('۱۲٫۵ میلیون تومان');
    // Two decimals, not one: 1,450,000 is ۱٫۴۵, not ۱٫۵.
    expect(formatMoney(1_450_000, { compact: true }).text).toBe('۱٫۴۵ میلیون تومان');
    expect(formatMoney(1_456_000, { compact: true }).text).toBe('۱٫۴۶ میلیون تومان');
  });
  it('puts $ before USD numbers', () => {
    expect(formatMoney(12.5, { currency: 'USD' }).text).toBe('$۱۲٫۵۰');
  });
});

describe('formatPercent', () => {
  it('formats ratio with sign', () => {
    expect(formatPercent(0.123, { ratio: true })).toBe('+۱۲٫۳٪');
  });
});

describe('cn', () => {
  it('keeps custom text size and text color together', () => {
    expect(cn('text-title text-fg')).toBe('text-title text-fg');
  });
  it('resolves conflicting custom sizes', () => {
    expect(cn('text-title', 'text-body')).toBe('text-body');
  });
  it('resolves conflicting radius tokens', () => {
    expect(cn('rounded-card', 'rounded-control')).toBe('rounded-control');
  });
});
