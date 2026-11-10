import { describe, expect, it } from 'vitest';
import type { Book } from './book';
import { addTransaction, deleteGoal, deleteTransaction, setAssetPrice, setGoal } from './write';

const book = {
  userId: 'u1',
  transactions: [],
  assets: [],
  wallets: [],
  categories: [],
  persons: [],
  goals: [],
  usdRate: 100_000,
} as unknown as Book;

describe('mcp write guards (no database call)', () => {
  it('rejects ids the user does not own', async () => {
    const r = await addTransaction(book, { type: 'EXPENSE', from: { kind: 'wallet', id: 'other-user-wallet' }, amount: 1 });
    expect(r).toEqual({ ok: false, error: 'unknown wallet/asset/person id' });
  });
  it('rejects a bad date', async () => {
    const r = await addTransaction(book, { type: 'EXPENSE', date: '2026-01-01', amount: 1 });
    expect(r.ok).toBe(false);
  });
  it('needs confirm to delete', async () => {
    expect(await deleteTransaction(book, 'x', false)).toEqual({ ok: false, error: 'set confirm: true to delete' });
    expect(await deleteGoal(book, 'x', false)).toEqual({ ok: false, error: 'set confirm: true to delete' });
  });
  it('rejects unknown asset for goals and prices', async () => {
    expect((await setGoal(book, { scope: 'asset', asset_id: 'x', kind: 'quantity', value: 1 })).ok).toBe(false);
    expect((await setAssetPrice(book, { asset_id: 'x', price_toman: 1 })).ok).toBe(false);
  });
});
