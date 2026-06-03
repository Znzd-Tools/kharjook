import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import type { Category, TelegramConnection, Transaction } from '@/shared/types/domain';
import { formatExpenseAlertMessage } from '@/features/notifications/telegram/utils/format-expense-alert';
import {
  sendTelegramMessage,
  TelegramSendError,
} from '@/features/notifications/telegram/utils/telegram-client';
import { loadExpenseAlertEnabled } from '@/features/notifications/services/bot-notification-settings';
import { buildUserNotificationSnapshot } from '@/features/notifications/utils/build-user-snapshot';

async function loadActiveConnection(userId: string): Promise<TelegramConnection | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('telegram_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  return (data as TelegramConnection | null) ?? null;
}

async function markConnectionInactive(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from('telegram_connections').update({ is_active: false }).eq('user_id', userId);
}

function expenseAmountToman(tx: Transaction): number | null {
  const value = Number(tx.amount_toman_at_time);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export async function notifyExpenseTransaction(
  userId: string,
  tx: Transaction
): Promise<void> {
  if (tx.type !== 'EXPENSE' || tx.user_id !== userId) return;

  const addedAmountToman = expenseAmountToman(tx);
  if (addedAmountToman == null) return;

  const alertEnabled = await loadExpenseAlertEnabled(userId);
  if (!alertEnabled) return;

  const connection = await loadActiveConnection(userId);
  if (!connection) return;

  const admin = createSupabaseAdminClient();
  const [
    { data: transactions },
    { data: categories },
    { data: wallets },
    { data: assets },
    { data: currencyRates },
  ] = await Promise.all([
    admin.from('transactions').select('*').eq('user_id', userId),
    admin.from('categories').select('*').eq('user_id', userId),
    admin.from('wallets').select('*').eq('user_id', userId).is('archived_at', null),
    admin.from('assets').select('*').eq('user_id', userId),
    admin.from('currency_rates').select('*').eq('user_id', userId),
  ]);

  const snapshot = buildUserNotificationSnapshot({
    transactions: (transactions ?? []) as Transaction[],
    categories: (categories ?? []) as Category[],
    wallets: wallets ?? [],
    assets: assets ?? [],
    currencyRates: currencyRates ?? [],
  });

  const categoryName = tx.category_id
    ? ((categories ?? []) as Category[]).find((c) => c.id === tx.category_id)?.name ?? null
    : null;

  const text = formatExpenseAlertMessage({
    addedAmountToman,
    todayTotalExpenseToman: snapshot.today.expense,
    categoryName,
    note: tx.note,
  });

  try {
    await sendTelegramMessage(connection.telegram_chat_id, text);
  } catch (err) {
    if (err instanceof TelegramSendError && err.blocked) {
      await markConnectionInactive(userId);
    } else {
      console.error('notifyExpenseTransaction failed', err);
    }
  }
}

export async function notifyExpenseTransactions(
  userId: string,
  transactions: Transaction[]
): Promise<void> {
  for (const tx of transactions) {
    await notifyExpenseTransaction(userId, tx);
  }
}
