import { describe, expect, it } from 'vitest';
import type { Transaction, Wallet } from '@/shared/types/domain';
import { buildSuggestion, matchWallet, type SmsRow } from './suggest';
import { parseSms } from './parse-sms';

const wallet = (id: string, name: string, extra: Partial<Wallet> = {}) =>
  ({ id, name, currency: 'IRT', archived_at: null, card_number: null, account_number: null, iban: null, ...extra }) as Wallet;
const wallets = [wallet('w-mellat', 'ملت', { card_number: '6104337812345678' }), wallet('w-saman', 'سامان'), wallet('w-usd', 'دلاری', { currency: 'USD' })];

const row = (id: string, text: string, extra: Partial<SmsRow> = {}): SmsRow => ({
  id, sender: null, body: text, received_at: '2026-11-08T10:00:00Z', parsed: parseSms(text, { today: { jy: 1405 } })!,
  status: 'new', wallet_id: null, transaction_id: null, ...extra,
});
const ctx = (inbox: SmsRow[], transactions: Transaction[] = []) => ({
  wallets, transactions, inbox, deadlines: [], receivedDate: () => '1405/08/17',
});

describe('matchWallet', () => {
  it('by card digits, then bank name', () => {
    expect(matchWallet(row('a', 'بانک صادرات\nخرید\nمبلغ: 850,000\nکارت:6104...5678\nمانده: 1,000,000'), wallets, [])).toBe('w-mellat');
    expect(matchWallet(row('b', 'بانک سامان\nبرداشت 1,000,000\nمانده 2,000,000'), wallets, [])).toBe('w-saman');
  });
});

describe('buildSuggestion', () => {
  it('expense first for a purchase, with every other choice', () => {
    const s = buildSuggestion(row('a', 'بانک ملت\nخرید\nمبلغ:1,000,000\nمانده:5,000,000'), ctx([]));
    expect(s.walletId).toBe('w-mellat');
    expect(s.choices.map((c) => c.key)).toEqual(['expense', 'transfer', 'buy', 'person']);
    const c = s.choices[0]!;
    expect(c.type === 'form' && c.href).toContain('type=EXPENSE');
    expect(c.type === 'form' && c.href).toContain('src=wallet%3Aw-mellat');
    expect(c.type === 'form' && c.href).toContain('amt=100000');
  });

  it('income shows sell, convert and person', () => {
    const s = buildSuggestion(row('a', 'بانک سامان\nواریز\nمبلغ 20,000,000\nمانده 30,000,000'), ctx([]));
    expect(s.choices.map((c) => c.key)).toEqual(['income', 'transfer', 'sell', 'convert', 'person']);
    const conv = s.choices.find((c) => c.key === 'convert')!;
    expect(conv.type === 'form' && conv.href).toContain('src=wallet%3Aw-usd');
  });

  it('pairs two SMS of one transfer between my accounts', () => {
    const outRow = row('o', 'بانک ملت\nانتقال وجه\nمبلغ:5,000,000\nمانده:1,000,000');
    const inRow = row('i', 'بانک سامان\nواریز\nمبلغ 5,000,000\nمانده 9,000,000', { received_at: '2026-11-08T10:02:00Z' });
    const s = buildSuggestion(outRow, ctx([outRow, inRow]));
    expect(s.pair?.id).toBe('i');
    expect(s.choices[0]).toMatchObject({ key: 'pair', label: 'انتقال از «ملت» به «سامان»' });
    const c = s.choices[0]!;
    expect(c.type === 'form' && c.href).toContain('pair=i');
  });

  it('finds an already recorded transaction', () => {
    const tx = { id: 't1', type: 'EXPENSE', date_string: '1405/08/16', source_wallet_id: 'w-mellat', source_amount: 100000, target_wallet_id: null } as unknown as Transaction;
    const s = buildSuggestion(row('a', 'بانک ملت\nخرید\nمبلغ:1,000,000\nمانده:5,000,000'), ctx([], [tx]));
    expect(s.choices[0]).toMatchObject({ key: 'match', transactionId: 't1' });
  });

  it('suggests paying a matching check', () => {
    const s = buildSuggestion(row('a', 'بانک ملت\nبرداشت چک\nمبلغ:120,000,000\nمانده:5,000,000'), {
      ...ctx([]),
      deadlines: [{ key: 'check:c1', kind: 'check', id: 'c1', title: 'رضایی', due: '1405/08/19', amount: 12_000_000, currency: 'IRT', assetId: null, walletId: null, bucket: 'week', daysLeft: 2, partial: false, categoryId: null }],
    });
    expect(s.choices[0]).toMatchObject({ key: 'settle:check:c1', label: 'پرداخت چک «رضایی»', walletId: 'w-mellat' });
  });
});
