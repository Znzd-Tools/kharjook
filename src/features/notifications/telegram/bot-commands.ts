import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import type { TelegramConnection } from '@/shared/types/domain';
import {
  refreshAndReportPricesForUser,
  sendMonthDebtsForUser,
  sendPortfolioForUser,
  sendPricesListForUser,
  sendTodayCashflowForUser,
} from '@/features/notifications/services/dispatch-notifications';
import { sendTelegramMessage } from '@/features/notifications/telegram/utils/telegram-client';
import {
  ALL_BOT_BUTTONS,
  BOT_LINKED_SUCCESS,
  BOT_PRICES_MENU_HINT,
  BOT_REPORTS_MENU_HINT,
  BOT_WELCOME_LINKED,
  BOT_WELCOME_UNLINKED,
  BTN_BACK,
  BTN_GET_PRICES,
  BTN_MENU_PRICES,
  BTN_MENU_REPORTS,
  BTN_MONTH_DEBTS,
  BTN_PORTFOLIO,
  BTN_TODAY_CASHFLOW,
  BTN_UPDATE_PRICES,
  buildMainReplyKeyboard,
  buildPricesReplyKeyboard,
  buildReportsReplyKeyboard,
} from '@/features/notifications/telegram/telegram-keyboard';

async function getConnectionByChatId(chatId: number): Promise<TelegramConnection | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('telegram_connections')
    .select('*')
    .eq('telegram_chat_id', chatId)
    .eq('is_active', true)
    .maybeSingle();
  return (data as TelegramConnection | null) ?? null;
}

export async function sendBotMenu(chatId: number, text: string): Promise<void> {
  await sendTelegramMessage(chatId, text, buildMainReplyKeyboard());
}

export async function sendWelcomeAfterLink(chatId: number): Promise<void> {
  await sendBotMenu(chatId, `${BOT_LINKED_SUCCESS}\n\n${BOT_WELCOME_LINKED}`);
}

export async function sendUnlinkedPrompt(chatId: number): Promise<void> {
  await sendTelegramMessage(chatId, BOT_WELCOME_UNLINKED);
}

async function requireConnection(chatId: number): Promise<TelegramConnection | null> {
  const connection = await getConnectionByChatId(chatId);
  if (!connection) await sendUnlinkedPrompt(chatId);
  return connection;
}

export async function handleBotMessage(chatId: number, text: string): Promise<void> {
  if (text === BTN_MENU_REPORTS) {
    const connection = await requireConnection(chatId);
    if (!connection) return;
    await sendTelegramMessage(chatId, BOT_REPORTS_MENU_HINT, buildReportsReplyKeyboard());
    return;
  }

  if (text === BTN_MENU_PRICES) {
    const connection = await requireConnection(chatId);
    if (!connection) return;
    await sendTelegramMessage(chatId, BOT_PRICES_MENU_HINT, buildPricesReplyKeyboard());
    return;
  }

  if (text === BTN_BACK) {
    const connection = await requireConnection(chatId);
    if (!connection) return;
    await sendBotMenu(chatId, 'منوی اصلی 👇');
    return;
  }

  if (text === BTN_TODAY_CASHFLOW) {
    const connection = await requireConnection(chatId);
    if (!connection) return;
    await sendTelegramMessage(chatId, '⏳ در حال محاسبه...', buildMainReplyKeyboard());
    await sendTodayCashflowForUser(connection.user_id, connection, {
      replyMarkup: buildMainReplyKeyboard(),
    });
    return;
  }

  if (text === BTN_PORTFOLIO) {
    const connection = await requireConnection(chatId);
    if (!connection) return;
    await sendTelegramMessage(chatId, '⏳ در حال محاسبه...', buildReportsReplyKeyboard());
    await sendPortfolioForUser(connection.user_id, connection, {
      replyMarkup: buildReportsReplyKeyboard(),
    });
    return;
  }

  if (text === BTN_MONTH_DEBTS) {
    const connection = await requireConnection(chatId);
    if (!connection) return;
    await sendTelegramMessage(chatId, '⏳ در حال بارگذاری...', buildReportsReplyKeyboard());
    await sendMonthDebtsForUser(connection.user_id, connection, {
      replyMarkup: buildReportsReplyKeyboard(),
    });
    return;
  }

  if (text === BTN_UPDATE_PRICES) {
    const connection = await requireConnection(chatId);
    if (!connection) return;
    await sendTelegramMessage(
      chatId,
      '⏳ در حال بروزرسانی قیمت‌ها...\nممکن است چند ثانیه طول بکشد.',
      buildPricesReplyKeyboard()
    );
    try {
      await refreshAndReportPricesForUser(connection.user_id, connection, {
        replyMarkup: buildPricesReplyKeyboard(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'خطای ناشناخته';
      await sendTelegramMessage(
        chatId,
        `❌ بروزرسانی ناموفق بود.\n${message}`,
        buildPricesReplyKeyboard()
      );
    }
    return;
  }

  if (text === BTN_GET_PRICES) {
    const connection = await requireConnection(chatId);
    if (!connection) return;
    await sendTelegramMessage(chatId, '⏳ در حال بارگذاری...', buildPricesReplyKeyboard());
    await sendPricesListForUser(connection.user_id, connection, {
      replyMarkup: buildPricesReplyKeyboard(),
    });
    return;
  }

  if (ALL_BOT_BUTTONS.has(text)) return;

  const connection = await getConnectionByChatId(chatId);
  if (connection) {
    await sendBotMenu(chatId, 'از منوی زیر استفاده کنید 👇');
  } else {
    await sendUnlinkedPrompt(chatId);
  }
}
