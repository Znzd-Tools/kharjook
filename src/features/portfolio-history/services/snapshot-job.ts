/**
 * Daily job step: store today's net-worth snapshot for every user, after the
 * price refresh. The first time for a user, also backfill the last 12
 * month-ends from transactions + stored prices (source = 'backfill').
 */
import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import { fetchAllUserTransactions } from '@/shared/lib/supabase/fetch-all-transactions';
import type { Asset, CurrencyRate, DailyPrice, Transaction, Wallet } from '@/shared/types/domain';
import { formatJalaali, todayJalaaliInTimezone } from '@/shared/utils/jalali';
import { buildRateHistories, type RateHistoryRow } from '@/shared/utils/rate-history';
import { buildSnapshot, pastMonthEnds } from '../utils/snapshot';

const BACKFILL_MONTHS = 12;

export async function snapshotUser(userId: string, opts: { backfill?: boolean } = {}): Promise<number> {
  const admin = createSupabaseAdminClient();
  const [tx, assets, wallets, prices, rates, history] = await Promise.all([
    fetchAllUserTransactions(admin, userId),
    admin.from('assets').select('*').eq('user_id', userId),
    admin.from('wallets').select('*').eq('user_id', userId).is('archived_at', null),
    admin.from('daily_prices').select('*').eq('user_id', userId),
    admin.from('currency_rates').select('*').eq('user_id', userId),
    admin.from('currency_rate_history').select('currency, date_string, toman_per_unit, source').eq('user_id', userId),
  ]);
  const data = {
    transactions: (tx.data ?? []) as Transaction[],
    assets: (assets.data ?? []) as Asset[],
    wallets: (wallets.data ?? []) as Wallet[],
    dailyPrices: (prices.data ?? []) as DailyPrice[],
    currencyRates: (rates.data ?? []) as CurrencyRate[],
  };
  if (data.assets.length === 0 && data.wallets.length === 0) return 0;

  const todayStr = formatJalaali(todayJalaaliInTimezone('Asia/Tehran'));
  const currentUsd = Number(data.currencyRates.find((r) => r.currency === 'USD')?.toman_per_unit) || 0;
  const histories = buildRateHistories({ ...data, savedHistory: (history.data ?? []) as RateHistoryRow[] });
  const usdAt = (d: string) => (d >= todayStr ? currentUsd : histories.USD.at(d) || currentUsd);

  const rows: (ReturnType<typeof buildSnapshot> & { source: 'daily' | 'backfill' })[] = [
    { ...buildSnapshot({ ...data, usdRate: currentUsd, todayStr, dateStr: todayStr }), source: 'daily' },
  ];
  if (opts.backfill) {
    for (const d of pastMonthEnds(todayStr, BACKFILL_MONTHS)) {
      rows.push({ ...buildSnapshot({ ...data, usdRate: usdAt(d), todayStr, dateStr: d }), source: 'backfill' });
    }
  }
  const { error } = await admin
    .from('portfolio_snapshots')
    .upsert(rows.map((r) => ({ ...r, user_id: userId })), { onConflict: 'user_id,date_string' });
  if (error) throw new Error(error.message);
  return rows.length;
}

export async function processPortfolioSnapshots(): Promise<{ users: number; errors: string[] }> {
  const admin = createSupabaseAdminClient();
  const [w, a, existing] = await Promise.all([
    admin.from('wallets').select('user_id'),
    admin.from('assets').select('user_id'),
    admin.from('portfolio_snapshots').select('user_id'),
  ]);
  const ids = new Set<string>([...((w.data ?? []) as { user_id: string }[]), ...((a.data ?? []) as { user_id: string }[])].map((r) => r.user_id));
  const count = new Map<string, number>();
  for (const r of (existing.data ?? []) as { user_id: string }[]) count.set(r.user_id, (count.get(r.user_id) ?? 0) + 1);
  const errors: string[] = [];
  let users = 0;
  for (const id of ids) {
    try {
      await snapshotUser(id, { backfill: (count.get(id) ?? 0) < 2 });
      users++;
    } catch (e) {
      errors.push(`snapshot ${id}: ${(e as Error).message}`);
    }
  }
  return { users, errors };
}
