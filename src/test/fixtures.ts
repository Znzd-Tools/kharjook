import type { Asset, Transaction } from '@/shared/types/domain';

export const testAsset: Asset = {
  id: 'a1',
  user_id: 'u1',
  category_id: null,
  name: 'طلا',
  unit: 'گرم',
  decimal_places: 2,
  price_toman: 1_000,
  price_usd: 10,
  icon_url: null,
  price_source_id: null,
  include_in_profit_loss: true,
};

let seq = 0;

/** Minimal transaction row for tests; fields default to null. */
export function makeTx(partial: Partial<Transaction> & Pick<Transaction, 'type'>): Transaction {
  seq += 1;
  return {
    id: partial.id ?? `t${seq}`,
    user_id: 'u1',
    date_string: '1403/01/01',
    note: null,
    created_at: `2024-01-01T00:00:${String(seq % 60).padStart(2, '0')}Z`,
    source_wallet_id: null,
    source_asset_id: null,
    source_person_id: null,
    target_wallet_id: null,
    target_asset_id: null,
    target_person_id: null,
    source_amount: null,
    target_amount: null,
    category_id: null,
    asset_id: null,
    amount: null,
    price_toman: null,
    usd_rate: 100,
    amount_toman_at_time: null,
    amount_usd_at_time: null,
    operation_id: null,
    ...partial,
  };
}

/** BUY `qty` of asset a1 at `price` Toman per unit on `date`. */
export function buy(date: string, qty: number, price: number, createdAt?: string): Transaction {
  return makeTx({
    ...(createdAt ? { created_at: createdAt } : {}),
    type: 'BUY',
    date_string: date,
    target_asset_id: 'a1',
    target_amount: qty,
    asset_id: 'a1',
    amount: qty,
    price_toman: price,
  });
}

/** SELL `qty` of asset a1 at `price` Toman per unit on `date`. */
export function sell(date: string, qty: number, price: number, createdAt?: string): Transaction {
  return makeTx({
    ...(createdAt ? { created_at: createdAt } : {}),
    type: 'SELL',
    date_string: date,
    source_asset_id: 'a1',
    source_amount: qty,
    asset_id: 'a1',
    amount: qty,
    price_toman: price,
  });
}
