import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import type { Person, TelegramConnection, Transaction } from '@/shared/types/domain';
import {
  buildPersonBalanceRows,
  formatPersonsSummaryMessage,
} from '@/features/notifications/telegram/utils/format-persons-list';
import {
  sendTelegramMessage,
  type TelegramReplyMarkup,
} from '@/features/notifications/telegram/utils/telegram-client';

async function loadPersonSummaryContext(userId: string) {
  const admin = createSupabaseAdminClient();
  const [{ data: persons }, { data: transactions }] = await Promise.all([
    admin.from('persons').select('*').eq('user_id', userId).order('order_index', { ascending: true }),
    admin.from('transactions').select('*').eq('user_id', userId),
  ]);

  return {
    persons: (persons ?? []) as Person[],
    transactions: (transactions ?? []) as Transaction[],
  };
}

export async function sendPersonsSummaryForUser(
  userId: string,
  connection: TelegramConnection,
  options?: { replyMarkup?: TelegramReplyMarkup }
): Promise<void> {
  const ctx = await loadPersonSummaryContext(userId);
  const rows = buildPersonBalanceRows(ctx.persons, ctx.transactions);
  const text = formatPersonsSummaryMessage(rows);
  await sendTelegramMessage(connection.telegram_chat_id, text, options?.replyMarkup);
}
