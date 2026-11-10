/**
 * Everything the MCP needs for one user, loaded with the service role.
 * EVERY query is filtered by user_id: the service role skips RLS.
 */
import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import { fetchAllUserTransactions } from '@/shared/lib/supabase/fetch-all-transactions';
import type {
  Asset, Category, CategorySpendingCap, Check, CurrencyRate, DailyPrice, Goal, Loan, LoanInstallment, Person, Subscription, Transaction, Wallet,
} from '@/shared/types/domain';

export interface Book {
  userId: string;
  transactions: Transaction[];
  assets: Asset[];
  wallets: Wallet[];
  categories: Category[];
  persons: Person[];
  dailyPrices: DailyPrice[];
  currencyRates: CurrencyRate[];
  goals: Goal[];
  checks: Check[];
  subscriptions: Subscription[];
  loans: Loan[];
  installments: LoanInstallment[];
  caps: CategorySpendingCap[];
  envelopes: { category_id: string; rollover: boolean; created_at: string }[];
  allocations: { category_id: string; month: string; amount_toman: number }[];
  usdRate: number;
}

export async function loadBook(userId: string): Promise<Book> {
  const a = createSupabaseAdminClient();
  const own = <T,>(table: string, cols = '*') => a.from(table).select(cols).eq('user_id', userId) as unknown as Promise<{ data: T[] | null }>;
  const [tx, assets, wallets, categories, persons, prices, rates, goals, checks, subs, loans, inst, caps, env, alloc] = await Promise.all([
    fetchAllUserTransactions(a, userId),
    own<Asset>('assets'),
    a.from('wallets').select('*').eq('user_id', userId).is('archived_at', null) as unknown as Promise<{ data: Wallet[] | null }>,
    own<Category>('categories'),
    own<Person>('persons'),
    own<DailyPrice>('daily_prices'),
    own<CurrencyRate>('currency_rates'),
    own<Goal>('goals'),
    a.from('checks').select('*').eq('user_id', userId).is('deleted_at', null) as unknown as Promise<{ data: Check[] | null }>,
    a.from('subscriptions').select('*').eq('user_id', userId).is('deleted_at', null) as unknown as Promise<{ data: Subscription[] | null }>,
    a.from('loans').select('*').eq('user_id', userId).is('deleted_at', null) as unknown as Promise<{ data: Loan[] | null }>,
    own<LoanInstallment>('loan_installments'),
    own<CategorySpendingCap>('category_spending_caps'),
    own<Book['envelopes'][number]>('budget_envelopes', 'category_id, rollover, created_at'),
    own<Book['allocations'][number]>('budget_allocations', 'category_id, month, amount_toman'),
  ]);
  const currencyRates = (rates.data ?? []) as CurrencyRate[];
  return {
    userId,
    transactions: (tx.data ?? []) as Transaction[],
    assets: assets.data ?? [],
    wallets: wallets.data ?? [],
    categories: categories.data ?? [],
    persons: persons.data ?? [],
    dailyPrices: prices.data ?? [],
    currencyRates,
    goals: goals.data ?? [],
    checks: checks.data ?? [],
    subscriptions: subs.data ?? [],
    loans: loans.data ?? [],
    installments: inst.data ?? [],
    caps: caps.data ?? [],
    envelopes: env.data ?? [],
    allocations: alloc.data ?? [],
    usdRate: Number(currencyRates.find((r) => r.currency === 'USD')?.toman_per_unit) || 0,
  };
}
