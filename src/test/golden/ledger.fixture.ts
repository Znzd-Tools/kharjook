/**
 * Golden ledger: a fixed, realistic data set used to freeze the current
 * output of every money calculation. If a refactor changes one number in
 * the golden snapshots, the change is a regression until proven otherwise.
 *
 * Today is pinned to 2026-11-08 (Jalali 1405/08/17) by the tests.
 */
import type {
  Asset,
  Category,
  CurrencyRate,
  DailyPrice,
  Goal,
  Person,
  Transaction,
  Wallet,
} from '@/shared/types/domain';

export const PINNED_NOW = new Date('2026-11-08T09:00:00Z');
export const TODAY = '1405/08/17';
export const USD_RATE = 100_000;

const base = { user_id: 'u1', icon_url: null, price_source_id: null } as const;

export const assets: Asset[] = [
  { ...base, id: 'gold', category_id: 'c-metal', name: 'طلا', unit: 'گرم', decimal_places: 2, price_toman: 9_000_000, price_usd: 90, include_in_profit_loss: true },
  { ...base, id: 'usd', category_id: 'c-fx', name: 'دلار', unit: 'دلار', decimal_places: 2, price_toman: 100_000, price_usd: 1, include_in_profit_loss: true },
  { ...base, id: 'fund', category_id: 'c-stock', name: 'صندوق', unit: 'واحد', decimal_places: 0, price_toman: 30_000, price_usd: 0.3, include_in_profit_loss: true },
  // Excluded from PnL but in balance.
  { ...base, id: 'car', category_id: null, name: 'خودرو', unit: 'دستگاه', decimal_places: 0, price_toman: 2_000_000_000, price_usd: 20_000, include_in_profit_loss: false },
  // Excluded from balance.
  { ...base, id: 'held', category_id: 'c-metal', name: 'امانی', unit: 'گرم', decimal_places: 2, price_toman: 9_000_000, price_usd: 90, include_in_profit_loss: true, include_in_balance: false },
  // Never priced (no live price, only trades).
  { ...base, id: 'coin', category_id: 'c-metal', name: 'سکه', unit: 'عدد', decimal_places: 0, price_toman: 0, price_usd: 0, include_in_profit_loss: true },
];

export const wallets: Wallet[] = [
  { id: 'w-irt', user_id: 'u1', name: 'ملت', currency: 'IRT', initial_balance: 50_000_000, icon_url: null, archived_at: null, created_at: '2025-01-01T00:00:00Z' },
  { id: 'w-cash', user_id: 'u1', name: 'نقد', currency: 'IRT', initial_balance: 2_000_000, icon_url: null, archived_at: null, created_at: '2025-01-01T00:00:00Z' },
  { id: 'w-usd', user_id: 'u1', name: 'دلاری', currency: 'USD', initial_balance: 100, icon_url: null, archived_at: null, created_at: '2025-01-01T00:00:00Z' },
] as Wallet[];

export const persons: Person[] = [
  { id: 'p-ali', user_id: 'u1', name: 'علی', created_at: '2025-01-01T00:00:00Z', updated_at: '2025-01-01T00:00:00Z' },
];

export const categories: Category[] = [
  { id: 'c-food', user_id: 'u1', name: 'خوراک', color: '#f00', kind: 'expense', parent_id: null },
  { id: 'c-cafe', user_id: 'u1', name: 'کافه', color: '#f00', kind: 'expense', parent_id: 'c-food' },
  { id: 'c-rent', user_id: 'u1', name: 'اجاره', color: '#f00', kind: 'expense', parent_id: null },
  { id: 'c-salary', user_id: 'u1', name: 'حقوق', color: '#0f0', kind: 'income', parent_id: null },
  { id: 'c-metal', user_id: 'u1', name: 'فلزات', color: '#ff0', kind: 'asset', parent_id: null },
  { id: 'c-fx', user_id: 'u1', name: 'ارز', color: '#0ff', kind: 'asset', parent_id: null },
  { id: 'c-stock', user_id: 'u1', name: 'سهام', color: '#00f', kind: 'asset', parent_id: null },
] as Category[];

export const currencyRates: CurrencyRate[] = [
  { id: 'r1', user_id: 'u1', currency: 'USD', toman_per_unit: USD_RATE, updated_at: '2026-11-01T00:00:00Z' },
] as CurrencyRate[];

export const dailyPrices: DailyPrice[] = [
  ...(['1404/12/29', '1405/01/01', '1405/06/31', '1405/08/16'] as const).flatMap((d, i) => [
    { user_id: 'u1', asset_id: 'gold', date_string: d, price_toman: [7_000_000, 7_100_000, 8_200_000, 9_000_000][i]!, price_usd: [80, 80, 85, 90][i]!, source: 'auto' as const },
    { user_id: 'u1', asset_id: 'fund', date_string: d, price_toman: [20_000, 20_500, 27_000, 30_000][i]!, price_usd: [0.25, 0.25, 0.28, 0.3][i]!, source: 'auto' as const },
    { user_id: 'u1', asset_id: 'usd', date_string: d, price_toman: [85_000, 86_000, 95_000, 100_000][i]!, price_usd: [1, 1, 1, 1][i]!, source: 'manual' as const },
  ]),
] as DailyPrice[];

export const goals: Goal[] = [
  { id: 'g1', user_id: 'u1', scope: 'asset', asset_id: 'gold', category_id: null, target_kind: 'quantity', target_quantity: 20, target_percent: null },
  { id: 'g2', user_id: 'u1', scope: 'asset', asset_id: 'usd', category_id: null, target_kind: 'allocation_percent', target_quantity: null, target_percent: 25 },
  { id: 'g3', user_id: 'u1', scope: 'asset_group', asset_id: null, category_id: 'c-metal', target_kind: 'allocation_percent', target_quantity: null, target_percent: 40 },
] as Goal[];

let n = 0;
function tx(p: Partial<Transaction> & Pick<Transaction, 'type' | 'date_string'>): Transaction {
  n += 1;
  return {
    id: `t${String(n).padStart(3, '0')}`,
    user_id: 'u1',
    note: null,
    created_at: `2026-01-01T00:${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}Z`,
    source_wallet_id: null, source_asset_id: null, source_person_id: null,
    target_wallet_id: null, target_asset_id: null, target_person_id: null,
    source_amount: null, target_amount: null, category_id: null,
    asset_id: null, amount: null, price_toman: null, usd_rate: USD_RATE,
    amount_toman_at_time: null, amount_usd_at_time: null, operation_id: null,
    ...p,
  };
}
const buyTx = (date: string, asset: string, qty: number, price: number, wallet = 'w-irt', rate = USD_RATE) =>
  tx({ type: 'BUY', date_string: date, source_wallet_id: wallet, source_amount: qty * price, target_asset_id: asset, target_amount: qty, asset_id: asset, amount: qty, price_toman: price, usd_rate: rate, amount_toman_at_time: qty * price, amount_usd_at_time: (qty * price) / rate });
const sellTx = (date: string, asset: string, qty: number, price: number, wallet = 'w-irt', rate = USD_RATE) =>
  tx({ type: 'SELL', date_string: date, source_asset_id: asset, source_amount: qty, target_wallet_id: wallet, target_amount: qty * price, asset_id: asset, amount: qty, price_toman: price, usd_rate: rate, amount_toman_at_time: qty * price, amount_usd_at_time: (qty * price) / rate });
const expense = (date: string, amount: number, cat: string, wallet = 'w-irt') =>
  tx({ type: 'EXPENSE', date_string: date, source_wallet_id: wallet, source_amount: amount, category_id: cat, amount_toman_at_time: amount, amount_usd_at_time: amount / USD_RATE });
const income = (date: string, amount: number, cat: string, wallet = 'w-irt') =>
  tx({ type: 'INCOME', date_string: date, target_wallet_id: wallet, target_amount: amount, category_id: cat, amount_toman_at_time: amount, amount_usd_at_time: amount / USD_RATE });

export const transactions: Transaction[] = [
  // Gold: buy, partial sell, full close, then reopen (position history).
  buyTx('1404/03/10', 'gold', 5, 5_000_000, 'w-irt', 70_000),
  buyTx('1404/06/01', 'gold', 5, 6_000_000, 'w-irt', 75_000),
  sellTx('1404/09/15', 'gold', 4, 6_500_000, 'w-irt', 80_000),
  sellTx('1404/11/20', 'gold', 6, 7_000_000, 'w-irt', 85_000), // position closed at 0
  buyTx('1405/02/05', 'gold', 8, 7_500_000, 'w-irt', 90_000), // new position
  sellTx('1405/07/01', 'gold', 2, 8_800_000, 'w-irt', 97_000),
  // USD asset bought before the year, held.
  buyTx('1404/08/01', 'usd', 300, 80_000, 'w-irt', 80_000),
  // Fund: buys in the year.
  buyTx('1405/01/15', 'fund', 1000, 21_000),
  buyTx('1405/05/10', 'fund', 500, 25_000),
  // Excluded asset bought.
  buyTx('1404/01/20', 'car', 1, 1_500_000_000),
  // Held-for-others asset (not in balance).
  buyTx('1405/03/01', 'held', 2, 7_800_000),
  // Never-priced asset: only trades give a price.
  buyTx('1405/04/01', 'coin', 3, 60_000_000),
  // Income and expenses across months.
  income('1405/01/01', 40_000_000, 'c-salary'),
  income('1405/07/01', 45_000_000, 'c-salary'),
  income('1405/08/01', 45_000_000, 'c-salary'),
  expense('1405/07/05', 12_000_000, 'c-rent'),
  expense('1405/08/02', 12_000_000, 'c-rent'),
  expense('1405/08/03', 850_000, 'c-cafe', 'w-cash'),
  expense('1405/08/10', 3_200_000, 'c-food'),
  expense('1405/08/12', 450_000, 'c-cafe', 'w-cash'),
  // Wallet → wallet transfer (neutral).
  tx({ type: 'TRANSFER', date_string: '1405/08/04', source_wallet_id: 'w-irt', source_amount: 5_000_000, target_wallet_id: 'w-cash', target_amount: 5_000_000 }),
  // Person: lend and partial payback.
  tx({ type: 'TRANSFER', date_string: '1405/06/01', source_wallet_id: 'w-irt', source_amount: 10_000_000, target_person_id: 'p-ali', target_amount: 10_000_000 }),
  tx({ type: 'TRANSFER', date_string: '1405/07/20', source_person_id: 'p-ali', source_amount: 4_000_000, target_wallet_id: 'w-irt', target_amount: 4_000_000 }),
  // USD wallet expense and income.
  tx({ type: 'EXPENSE', date_string: '1405/08/05', source_wallet_id: 'w-usd', source_amount: 20, category_id: 'c-food', amount_toman_at_time: 2_000_000, amount_usd_at_time: 20 }),
  // Legacy unpriced expense (null snapshot).
  tx({ type: 'EXPENSE', date_string: '1405/08/06', source_wallet_id: 'w-irt', source_amount: 100_000, category_id: 'c-food' }),
];
