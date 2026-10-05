import { describe, expect, it } from 'vitest';
import { formatAssetAmount } from '@/shared/utils/format-asset-amount';

describe('formatAssetAmount', () => {
  it('does not drop a digit on exact decimal values (x * 10^n float error)', () => {
    expect(formatAssetAmount(0.29, 2)).toBe('0.29');
    expect(formatAssetAmount(1.13, 2)).toBe('1.13');
    expect(formatAssetAmount(9.95, 2)).toBe('9.95');
    expect(formatAssetAmount(1.005, 3)).toBe('1.005');
  });

  it('absorbs float noise from the holdings replay', () => {
    expect(formatAssetAmount(5 - 4.9, 1)).toBe('0.1'); // 0.0999…96
    expect(formatAssetAmount(3 - 0.1 - 0.2, 1)).toBe('2.7'); // 2.6999…97
    expect(formatAssetAmount(1 - 0.9, 4)).toBe('0.1');
  });

  it('still truncates real fractions (never shows more than held)', () => {
    expect(formatAssetAmount(0.0999, 1)).toBe('0');
    expect(formatAssetAmount(1.23456789, 4)).toBe('1.2345');
    expect(formatAssetAmount(0.00000008, 8)).toBe('0.00000008');
  });

  it('keeps grouping, sign, and no negative zero', () => {
    expect(formatAssetAmount(1234567.5, 2)).toBe('1,234,567.5');
    expect(formatAssetAmount(-2.5, 2)).toBe('-2.5');
    expect(formatAssetAmount(-1e-12, 4)).toBe('0');
    expect(formatAssetAmount(12, 0)).toBe('12');
    expect(formatAssetAmount(Number.NaN, 2)).toBe('0');
  });
});
