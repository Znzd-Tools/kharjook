import { describe, expect, it } from 'vitest';
import { toPersianDigits } from '@/shared/utils/format-display-number';
import { formatJalaali, parseJalaali } from '@/shared/utils/jalali';

describe('toPersianDigits', () => {
  it('converts latin digits to persian', () => {
    expect(toPersianDigits('123')).toBe('۱۲۳');
    expect(toPersianDigits(45)).toBe('۴۵');
  });
});

describe('jalali', () => {
  it('round-trips a known date', () => {
    const parsed = parseJalaali('1403/01/01');
    expect(parsed).toEqual({ jy: 1403, jm: 1, jd: 1 });
    expect(formatJalaali(parsed!)).toBe('1403/01/01');
  });
});
