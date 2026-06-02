import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import type { TelegramConnection } from '@/shared/types/domain';
import {
  buildCashflowReplyKeyboard,
  buildMainReplyKeyboard,
  buildPricesReplyKeyboard,
  buildQuickAddReplyKeyboard,
  buildReportsReplyKeyboard,
  BOT_CASHFLOW_MENU_HINT,
  BOT_PRICES_MENU_HINT,
  BOT_QUICK_ADD_HINT,
  BOT_REPORTS_MENU_HINT,
  BOT_SETTINGS_MENU_HINT,
  type BotMenuId,
} from '@/features/notifications/telegram/telegram-keyboard';
import type { TelegramReplyMarkup } from '@/features/notifications/telegram/utils/telegram-client';

const VALID_MENUS: BotMenuId[] = ['main', 'cashflow', 'reports', 'prices', 'settings', 'quick_add'];

function normalizeStack(stack: string[] | null | undefined): BotMenuId[] {
  const filtered = (stack ?? ['main']).filter((item): item is BotMenuId =>
    VALID_MENUS.includes(item as BotMenuId)
  );
  return filtered.length > 0 ? filtered : ['main'];
}

export async function getConnectionByChatId(chatId: number): Promise<TelegramConnection | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('telegram_connections')
    .select('*')
    .eq('telegram_chat_id', chatId)
    .eq('is_active', true)
    .maybeSingle();
  return (data as TelegramConnection | null) ?? null;
}

export async function getMenuStack(chatId: number): Promise<BotMenuId[]> {
  const conn = await getConnectionByChatId(chatId);
  if (!conn) return ['main'];
  return normalizeStack(conn.menu_stack);
}

export async function resetMenuStack(chatId: number): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from('telegram_connections')
    .update({ menu_stack: ['main'], bot_flow: null })
    .eq('telegram_chat_id', chatId)
    .eq('is_active', true);
}

export async function pushMenu(chatId: number, menu: BotMenuId): Promise<void> {
  const stack = await getMenuStack(chatId);
  if (stack[stack.length - 1] === menu) return;
  const next = [...stack, menu];
  const admin = createSupabaseAdminClient();
  await admin
    .from('telegram_connections')
    .update({ menu_stack: next })
    .eq('telegram_chat_id', chatId)
    .eq('is_active', true);
}

export async function popMenu(chatId: number): Promise<BotMenuId> {
  const stack = await getMenuStack(chatId);
  const next = stack.length > 1 ? stack.slice(0, -1) : ['main'];
  const admin = createSupabaseAdminClient();
  await admin
    .from('telegram_connections')
    .update({ menu_stack: next })
    .eq('telegram_chat_id', chatId)
    .eq('is_active', true);
  return (next[next.length - 1] ?? 'main') as BotMenuId;
}

export function keyboardForMenu(menu: BotMenuId): TelegramReplyMarkup {
  switch (menu) {
    case 'cashflow':
      return buildCashflowReplyKeyboard();
    case 'reports':
      return buildReportsReplyKeyboard();
    case 'prices':
      return buildPricesReplyKeyboard();
    case 'settings':
      return buildMainReplyKeyboard();
    case 'quick_add':
      return buildQuickAddReplyKeyboard();
    default:
      return buildMainReplyKeyboard();
  }
}

export function hintForMenu(menu: BotMenuId): string {
  switch (menu) {
    case 'cashflow':
      return BOT_CASHFLOW_MENU_HINT;
    case 'reports':
      return BOT_REPORTS_MENU_HINT;
    case 'prices':
      return BOT_PRICES_MENU_HINT;
    case 'settings':
      return BOT_SETTINGS_MENU_HINT;
    case 'quick_add':
      return BOT_QUICK_ADD_HINT;
    default:
      return 'منوی اصلی 👇';
  }
}

export async function getBotFlow(chatId: number): Promise<Record<string, unknown> | null> {
  const conn = await getConnectionByChatId(chatId);
  return (conn?.bot_flow as Record<string, unknown> | null) ?? null;
}

export async function setBotFlow(
  chatId: number,
  flow: Record<string, unknown> | null
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin
    .from('telegram_connections')
    .update({ bot_flow: flow })
    .eq('telegram_chat_id', chatId)
    .eq('is_active', true);
}

export async function clearBotFlow(chatId: number): Promise<void> {
  await setBotFlow(chatId, null);
}
