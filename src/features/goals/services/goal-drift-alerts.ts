import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import type {
  Asset,
  Category,
  CurrencyRate,
  Goal,
  TelegramConnection,
  Transaction,
} from '@/shared/types/domain';
import {
  buildGoalDriftRows,
  filterDriftedGoalRows,
  sortGoalDriftRows,
} from '@/features/goals/utils/goal-drift-rows';
import { formatGoalsDriftMessage } from '@/features/notifications/telegram/utils/format-goals-drift';
import {
  sendTelegramMessage,
  TelegramSendError,
  type TelegramReplyMarkup,
} from '@/features/notifications/telegram/utils/telegram-client';

async function loadGoalDriftContext(userId: string) {
  const admin = createSupabaseAdminClient();
  const [{ data: goals }, { data: assets }, { data: categories }, { data: transactions }, { data: rates }] =
    await Promise.all([
      admin.from('goals').select('*').eq('user_id', userId),
      admin.from('assets').select('*').eq('user_id', userId),
      admin.from('categories').select('*').eq('user_id', userId),
      admin.from('transactions').select('*').eq('user_id', userId),
      admin.from('currency_rates').select('*').eq('user_id', userId),
    ]);

  const usdRate =
    ((rates ?? []) as CurrencyRate[]).find((row) => row.currency === 'USD')?.toman_per_unit ?? 0;

  return {
    goals: (goals ?? []) as Goal[],
    assets: (assets ?? []) as Asset[],
    categories: (categories ?? []) as Category[],
    transactions: (transactions ?? []) as Transaction[],
    usdRate,
  };
}

export async function sendGoalsDriftForUser(
  userId: string,
  connection: TelegramConnection,
  options?: { replyMarkup?: TelegramReplyMarkup }
): Promise<void> {
  const ctx = await loadGoalDriftContext(userId);
  const rows = sortGoalDriftRows(
    filterDriftedGoalRows(
      buildGoalDriftRows({
        ...ctx,
        currencyMode: 'TOMAN',
      })
    )
  );
  const text = formatGoalsDriftMessage(rows);
  await sendTelegramMessage(connection.telegram_chat_id, text, options?.replyMarkup);
}

export { TelegramSendError };
