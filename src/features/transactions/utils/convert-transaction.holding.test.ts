import { describe, expect, it } from 'vitest';
import { assetHolding } from '@/features/transactions/utils/convert-transaction';
import { calculateAssetStats } from '@/shared/utils/calculate-asset-stats';
import type { Asset, Transaction } from '@/shared/types/domain';

const asset = {
  id: 'a1',
  user_id: 'u1',
  category_id: null,
  name: 'طلا',
  unit: 'گرم',
  decimal_places: 2,
  price_toman: 1_000_000,
  price_usd: 10,
  icon_url: null,
  price_source_id: null,
  include_in_profit_loss: true,
} as Asset;

function tx(partial: Partial<Transaction> & Pick<Transaction, 'type'>): Transaction {
  return {
    id: partial.id ?? 't1',
    user_id: 'u1',
    type: partial.type,
    date_string: partial.date_string ?? '1403/01/01',
    note: null,
    source_wallet_id: null,
    source_asset_id: partial.source_asset_id ?? null,
    source_person_id: null,
    target_wallet_id: null,
    target_asset_id: partial.target_asset_id ?? null,
    target_person_id: null,
    source_amount: partial.source_amount ?? null,
    target_amount: partial.target_amount ?? null,
    category_id: null,
    asset_id: partial.asset_id ?? null,
    amount: partial.amount ?? null,
    price_toman: partial.price_toman ?? null,
    usd_rate: partial.usd_rate ?? 60000,
    amount_toman_at_time: null,
    amount_usd_at_time: null,
    operation_id: null,
    created_at: partial.created_at ?? '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as Transaction;
}

describe('assetHolding', () => {
  it('matches assets-list totalAmount when poly amounts disagree with amount', () => {
    const rows = [
      tx({
        id: 'buy',
        type: 'BUY',
        asset_id: 'a1',
        target_asset_id: 'a1',
        // Legacy qty field (assets list) vs mismatched poly field (old form bug).
        amount: 900,
        target_amount: 854,
        price_toman: 1_000_000,
        created_at: '2024-01-01T00:00:00Z',
      }),
    ];

    expect(assetHolding('a1', rows)).toBe(900);
    expect(calculateAssetStats(asset, rows, 'TOMAN', 60000).totalAmount).toBe(900);
  });

  it('ignores disposals that lack price_toman, same as assets list', () => {
    const rows = [
      tx({
        id: 'buy',
        type: 'BUY',
        asset_id: 'a1',
        target_asset_id: 'a1',
        amount: 900,
        target_amount: 900,
        price_toman: 1_000_000,
        created_at: '2024-01-01T00:00:00Z',
      }),
      tx({
        id: 'xfer',
        type: 'TRANSFER',
        source_asset_id: 'a1',
        source_amount: 46,
        amount: null,
        price_toman: null,
        created_at: '2024-01-02T00:00:00Z',
      }),
    ];

    expect(assetHolding('a1', rows)).toBe(900);
    expect(calculateAssetStats(asset, rows, 'TOMAN', 60000).totalAmount).toBe(900);
  });
});
