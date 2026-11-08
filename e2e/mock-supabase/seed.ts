/**
 * Seed for the mock Supabase: the golden ledger plus one row of each
 * deadline type, so every screen has data.
 */
import {
  assets, categories, currencyRates, dailyPrices, goals, persons, transactions, wallets,
} from '../../src/test/golden/ledger.fixture.ts';

const now = '2026-11-01T00:00:00Z';
const stamp = { user_id: 'u1', created_at: now, updated_at: now };

export const TEST_USER = { id: 'u1', email: 'test@kharjook.dev', password: 'password123' };

export function buildSeed(): Record<string, Record<string, unknown>[]> {
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
  return {
    assets: clone(assets).map((a, i) => ({ ...a, order_index: i, created_at: now })),
    // Realistic balance for the main wallet (the golden fixture overspends it on purpose).
    wallets: clone(wallets).map((w, i) => ({ ...w, ...(w.id === 'w-irt' ? { initial_balance: 2_000_000_000 } : {}), order_index: i, card_number: null, account_number: null, iban: null, account_owner_name: null })),
    persons: clone(persons),
    categories: clone(categories).map((c, i) => ({ ...c, order_index: i, created_at: now })),
    currency_rates: clone(currencyRates),
    currency_rate_history: [],
    daily_prices: clone(dailyPrices).map((d) => ({ ...d, created_at: now, updated_at: now })),
    goals: clone(goals),
    transactions: clone(transactions),
    category_spending_caps: [
      { id: 'cap1', category_id: 'c-food', monthly_limit_toman: 5_000_000, ...stamp },
    ],
    loans: [
      {
        id: 'loan1', title: 'وام مسکن', type: 'loan', category_id: 'c-rent', currency: 'IRT', asset_id: null,
        installment_amount: 5_000_000, total_amount: 60_000_000, loan_start_date_string: '1405/01/01',
        first_due_date_string: '1405/02/18', repeat_count: 12, interval_number: 1, interval_period: 'month',
        auto_income_on_create: false, auto_income_wallet_id: null, description: null, reminder_days_before: [1],
        deleted_at: null, ...stamp,
      },
    ],
    loan_installments: Array.from({ length: 12 }, (_, i) => {
      const m = 2 + i;
      const jy = 1405 + Math.floor((m - 1) / 12);
      const jm = ((m - 1) % 12) + 1;
      const paid = i < 6;
      return {
        id: `inst${i + 1}`, loan_id: 'loan1', due_date_string: `${jy}/${String(jm).padStart(2, '0')}/18`,
        amount: 5_000_000, paid_amount: paid ? 5_000_000 : 0, sequence_no: i + 1, is_paid: paid,
        paid_at: paid ? now : null, paid_transaction_id: null, note: null, ...stamp,
      };
    }),
    checks: [
      {
        id: 'chk1', title: 'چک آقای رضایی', bank_name: 'ملت', check_number: '123456', amount: 12_000_000, currency: 'IRT',
        due_date_string: '1405/08/19', wallet_id: 'w-irt', category_id: 'c-rent', status: 'pending', cleared_at: null,
        paid_transaction_id: null, note: null, deleted_at: null, ...stamp,
      },
    ],
    subscriptions: [
      {
        id: 'sub1', platform: 'اینترنت', amount: 450_000, currency: 'IRT', interval_number: 1, interval_period: 'month',
        next_due_date_string: '1405/08/20', wallet_id: 'w-irt', category_id: 'c-food', status: 'active',
        cancelled_at: null, reminder_days_before: [1], note: null, deleted_at: null, ...stamp,
      },
      {
        id: 'sub2', platform: 'Spotify', amount: 99.99, currency: 'TRY', interval_number: 1, interval_period: 'month',
        next_due_date_string: '1405/08/25', wallet_id: null, category_id: null, status: 'active',
        cancelled_at: null, reminder_days_before: [1], note: null, deleted_at: null, ...stamp,
      },
    ],
    subscription_payments: [],
    budget_envelopes: [],
    budget_allocations: [],
    wallet_savings_pots: [],
    price_sources: [],
    price_source_settings: [],
    notification_settings: [],
    notification_deliveries: [],
    telegram_connections: [],
    telegram_link_tokens: [],
    user_preferences: [],
  };
}
