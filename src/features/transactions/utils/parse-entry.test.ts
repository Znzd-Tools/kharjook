import { describe, expect, it } from 'vitest';
import type { Category, Wallet } from '@/shared/types/domain';
import { parseEntry, parseQuickText } from './parse-entry';

const categories = [
  { id: 'cafe', name: 'کافه', kind: 'expense' },
  { id: 'food', name: 'خوراک', kind: 'expense' },
  { id: 'salary', name: 'حقوق', kind: 'income' },
] as Category[];
const wallets = [
  { id: 'cash', name: 'نقد', archived_at: null },
  { id: 'mellat', name: 'بانک ملت', archived_at: null },
] as Wallet[];
const ctx = { categories, wallets };

describe('parseQuickText', () => {
  it('reads amount with multiplier, category and wallet', () => {
    expect(parseQuickText('۸۵ هزار کافه نقد', ctx)).toMatchObject({ type: 'EXPENSE', amount: 85_000, categoryId: 'cafe', walletId: 'cash' });
  });
  it('reads attached multipliers and million', () => {
    expect(parseQuickText('1.5m خوراک', ctx)?.amount).toBe(1_500_000);
    expect(parseQuickText('۲ میلیون خوراک', ctx)?.amount).toBe(2_000_000);
  });
  it('detects income from an income category name', () => {
    expect(parseQuickText('حقوق ۴۵ میلیون ملت', ctx)).toMatchObject({ type: 'INCOME', amount: 45_000_000, categoryId: 'salary', walletId: 'mellat' });
  });
  it('keeps unknown words as the note', () => {
    expect(parseQuickText('120000 کافه با علی', ctx)?.note).toBe('با علی');
  });
  it('handles grouped numbers', () => {
    expect(parseQuickText('۱٬۲۵۰٬۰۰۰ تومان خوراک', ctx)?.amount).toBe(1_250_000);
  });
  it('returns null for empty input', () => {
    expect(parseQuickText('   ', ctx)).toBeNull();
  });
});

describe('parseEntry', () => {
  it('reads quick text', () => {
    expect(parseEntry('۵۰ هزار کافه', ctx)?.source).toBe('text');
  });
});
