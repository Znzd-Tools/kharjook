import { describe, expect, it } from 'vitest';
import { buildPayload, recomputeTransferTarget } from '@/features/transactions/utils/transaction-form-logic';
import type { FormState } from '@/features/transactions/utils/transaction-form-types';
import type { Person, Wallet } from '@/shared/types/domain';

const wallets = [
  { id: 'w-irt', currency: 'IRT' },
  { id: 'w-usd', currency: 'USD' },
] as Wallet[];
const persons = [
  { id: 'p-irt', name: 'علی' },
  { id: 'p-usd', name: 'سارا', currency: 'USD' },
] as Person[];

const f = (o: Partial<FormState>): FormState => ({
  type: 'TRANSFER',
  date: '1405/08/20',
  note: '',
  categoryId: null,
  sourceKind: 'wallet',
  sourceId: 'w-usd',
  targetKind: 'person',
  targetId: 'p-usd',
  sourceAmount: '100',
  targetAmount: '',
  priceToman: '',
  usdRate: '100000',
  ...o,
});

describe('person currency', () => {
  it('USD wallet → USD person: the person side mirrors the amount (100 USD)', () => {
    expect(recomputeTransferTarget(f({}), wallets, [], [], 100_000, persons).targetAmount).toBe('100');
  });

  it('USD person → USD wallet (return): mirrors too', () => {
    const next = f({ sourceKind: 'person', sourceId: 'p-usd', targetKind: 'wallet', targetId: 'w-usd', sourceAmount: '40' });
    expect(recomputeTransferTarget(next, wallets, [], [], 100_000, persons).targetAmount).toBe('40');
  });

  it('IRT wallet → IRT person (no currency column): mirrors, so a typo on the second field is not possible', () => {
    const next = f({ sourceId: 'w-irt', targetId: 'p-irt', sourceAmount: '4500000' });
    expect(recomputeTransferTarget(next, wallets, [], [], 100_000, persons).targetAmount).toBe('4500000');
  });

  it('IRT wallet → USD person: different currencies, the user types what the person side gets', () => {
    const next = f({ sourceId: 'w-irt', sourceAmount: '10000000', targetAmount: '95' });
    expect(recomputeTransferTarget(next, wallets, [], [], 100_000, persons).targetAmount).toBe('95');
  });

  it('expense paid by a USD person is valued in Toman at the USD rate', () => {
    const p = buildPayload(
      f({ type: 'EXPENSE', categoryId: 'c', sourceKind: 'person', sourceId: 'p-usd', targetKind: null, targetId: null, sourceAmount: '20' }),
      'u1', wallets, [], 100_000, persons
    );
    expect(p.amount_toman_at_time).toBe(2_000_000);
    expect(p.amount_usd_at_time).toBe(20);
  });

  it('income to an IRT person stays 1:1 in Toman', () => {
    const p = buildPayload(
      f({ type: 'INCOME', categoryId: 'c', sourceKind: null, sourceId: null, targetKind: 'person', targetId: 'p-irt', targetAmount: '500000' }),
      'u1', wallets, [], 100_000, persons
    );
    expect(p.amount_toman_at_time).toBe(500_000);
  });
});

describe('person opening balance', () => {
  const tx = (o: Record<string, unknown>) => ({ id: Math.random().toString(), ...o }) as never;

  it('starts from initial_balance; old persons without it start at 0', async () => {
    const { calculatePersonBalance } = await import('@/shared/utils/calculate-person-balance');
    const txs = [tx({ target_person_id: 'p', target_amount: 50 }), tx({ source_person_id: 'p', source_amount: 20 })];
    expect(calculatePersonBalance({ id: 'p', initial_balance: -300 }, txs)).toBe(-270);
    expect(calculatePersonBalance({ id: 'p' }, txs)).toBe(30);
  });

  it('a payment that clears an opening debt brings the balance to 0', async () => {
    const { calculatePersonBalance } = await import('@/shared/utils/calculate-person-balance');
    // I owe 300 USD; I transfer 300 USD from my wallet to the person.
    expect(calculatePersonBalance({ id: 'p', initial_balance: -300 }, [tx({ target_person_id: 'p', target_amount: 300 })])).toBe(0);
  });
});
