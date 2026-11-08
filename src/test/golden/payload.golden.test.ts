/**
 * Golden tests for what the add/edit form SAVES. The v2 add screen must
 * call these same builders, so the database rows stay identical.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildPayload, validateForm, validateSourceFunds } from '@/features/transactions/utils/transaction-form-logic';
import { buildConvertPayloads, validateConvertForm, type ConvertFormState } from '@/features/transactions/utils/convert-transaction';
import type { FormState } from '@/features/transactions/utils/transaction-form-types';
import { PINNED_NOW, USD_RATE, currencyRates, persons, transactions, wallets } from './ledger.fixture';

const form = (p: Partial<FormState> & Pick<FormState, 'type'>): FormState => ({
  date: '1405/08/17', sourceKind: null, sourceId: null, targetKind: null, targetId: null,
  sourceAmount: '', targetAmount: '', priceToman: '', usdRate: String(USD_RATE), categoryId: null, note: '',
  ...p,
});

const CASES: Record<string, FormState> = {
  expenseFromWallet: form({ type: 'EXPENSE', sourceKind: 'wallet', sourceId: 'w-irt', sourceAmount: '850000', categoryId: 'c-cafe', note: 'قهوه' }),
  expenseFromUsdWallet: form({ type: 'EXPENSE', sourceKind: 'wallet', sourceId: 'w-usd', sourceAmount: '12.5', categoryId: 'c-food' }),
  expenseFromAsset: form({ type: 'EXPENSE', sourceKind: 'asset', sourceId: 'gold', sourceAmount: '0.5', priceToman: '9000000', categoryId: 'c-food' }),
  expenseFromPerson: form({ type: 'EXPENSE', sourceKind: 'person', sourceId: 'p-ali', sourceAmount: '300000', categoryId: 'c-food' }),
  incomeToWallet: form({ type: 'INCOME', targetKind: 'wallet', targetId: 'w-irt', targetAmount: '45000000', categoryId: 'c-salary' }),
  incomeToAsset: form({ type: 'INCOME', targetKind: 'asset', targetId: 'usd', targetAmount: '50', priceToman: '100000', categoryId: 'c-salary' }),
  transferWalletToWallet: form({ type: 'TRANSFER', sourceKind: 'wallet', sourceId: 'w-irt', targetKind: 'wallet', targetId: 'w-cash', sourceAmount: '1000000', targetAmount: '1000000' }),
  transferWalletToUsdWallet: form({ type: 'TRANSFER', sourceKind: 'wallet', sourceId: 'w-irt', targetKind: 'wallet', targetId: 'w-usd', sourceAmount: '10000000', targetAmount: '100' }),
  transferWalletToAsset: form({ type: 'TRANSFER', sourceKind: 'wallet', sourceId: 'w-irt', targetKind: 'asset', targetId: 'gold', sourceAmount: '9000000', targetAmount: '1', priceToman: '9000000' }),
  transferToPerson: form({ type: 'TRANSFER', sourceKind: 'wallet', sourceId: 'w-irt', targetKind: 'person', targetId: 'p-ali', sourceAmount: '2000000', targetAmount: '2000000' }),
  buyAsset: form({ type: 'BUY', sourceKind: 'wallet', sourceId: 'w-irt', targetKind: 'asset', targetId: 'fund', sourceAmount: '3000000', targetAmount: '100', priceToman: '30000' }),
  sellAsset: form({ type: 'SELL', sourceKind: 'asset', sourceId: 'gold', targetKind: 'wallet', targetId: 'w-irt', sourceAmount: '1', targetAmount: '9000000', priceToman: '9000000' }),
};

beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(PINNED_NOW);
});
afterAll(() => vi.useRealTimers());

describe('golden: transaction payloads', () => {
  for (const [name, f] of Object.entries(CASES)) {
    it(name, async () => {
      const out = {
        validation: validateForm(f, wallets),
        funds: validateSourceFunds(f, wallets, transactions, persons),
        payload: buildPayload(f, 'u1', wallets, currencyRates, USD_RATE),
      };
      await expect(JSON.stringify(out, null, 2)).toMatchFileSnapshot(`./__golden__/payload-${name}.json`);
    });
  }

  it('convert gold → usd', async () => {
    const f: ConvertFormState = {
      date: '1405/08/17', note: '', sourceAssetId: 'gold', sourceAmount: '1', sellPriceToman: '9000000', sellUsdRate: String(USD_RATE),
      sellTargetWalletId: null, targetAssetId: 'usd', targetAmount: '90', buyPriceToman: '100000', buyUsdRate: String(USD_RATE),
      buySourceWalletId: null, matchBuyValue: true, operationId: null, sellTransactionId: null, buyTransactionId: null,
    } as ConvertFormState;
    const out = {
      validation: validateConvertForm(f, transactions, wallets),
      payloads: buildConvertPayloads(f, 'u1', wallets, currencyRates, USD_RATE, 'op-1'),
    };
    await expect(JSON.stringify(out, null, 2)).toMatchFileSnapshot('./__golden__/payload-convert.json');
  });
});
