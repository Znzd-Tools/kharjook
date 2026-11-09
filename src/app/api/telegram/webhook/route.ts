import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import { consumeTelegramLinkToken } from '@/features/notifications/telegram/utils/link-token';
import { sendTelegramMessage } from '@/features/notifications/telegram/utils/telegram-client';
import {
  BOT_LINKED,
  BOT_ONLY_NOTIFY,
  BOT_UNLINKED,
  getConnectionByChatId,
  handleBotCallback,
  handleBotText,
} from '@/features/notifications/telegram/bot';

export const runtime = 'nodejs';

/** Browser GET is not how Telegram delivers updates — this is only a health check. */
export async function GET() {
  return NextResponse.json({ ok: true, message: 'Kharjook Telegram webhook is live. Telegram sends POST here, not GET.' });
}

type TelegramUpdate = {
  message?: { chat: { id: number }; from?: { id: number; username?: string }; text?: string };
  callback_query?: { id: string; data?: string; message?: { message_id?: number; chat?: { id?: number } } };
};

/** The bot only links accounts, sends notifications and handles reminder buttons. */
export async function POST(request: Request) {
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!webhookSecret && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 });
  }
  if (webhookSecret && request.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const update = (await request.json()) as TelegramUpdate;

  if (update.callback_query?.data) {
    const chatId = update.callback_query.message?.chat?.id;
    if (chatId) {
      try {
        await handleBotCallback({
          chatId,
          data: update.callback_query.data,
          callbackQueryId: update.callback_query.id,
          messageId: update.callback_query.message?.message_id,
        });
      } catch (err) {
        console.error('Telegram callback failed', err);
        await sendTelegramMessage(chatId, '❌ خطا رخ داد. دوباره تلاش کنید.');
      }
    }
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message?.text || !message.chat?.id) return NextResponse.json({ ok: true });
  const chatId = message.chat.id;
  const text = message.text.trim();

  if (!text.startsWith('/start')) {
    await handleBotText(chatId);
    return NextResponse.json({ ok: true });
  }

  const token = text.split(/\s+/)[1]?.trim();
  if (!token) {
    await sendTelegramMessage(chatId, (await getConnectionByChatId(chatId)) ? BOT_ONLY_NOTIFY : BOT_UNLINKED, { remove_keyboard: true });
    return NextResponse.json({ ok: true });
  }

  const consumed = await consumeTelegramLinkToken(token);
  if (!consumed) {
    await sendTelegramMessage(chatId, '❌ لینک نامعتبر یا منقضی شده. دوباره از اپ تلاش کنید.');
    return NextResponse.json({ ok: true });
  }

  const admin = createSupabaseAdminClient();
  await admin.from('telegram_connections').delete().eq('telegram_chat_id', chatId);
  const { error: connErr } = await admin.from('telegram_connections').upsert({
    user_id: consumed.userId,
    telegram_chat_id: chatId,
    telegram_user_id: message.from?.id ?? null,
    telegram_username: message.from?.username ?? null,
    is_active: true,
    linked_at: new Date().toISOString(),
    bot_flow: null,
  });
  if (connErr) {
    console.error(connErr);
    await sendTelegramMessage(chatId, '❌ خطا در اتصال. دوباره تلاش کنید.');
    return NextResponse.json({ ok: true });
  }

  // Keep existing notification choices; create defaults only for a new user.
  await admin
    .from('notification_settings')
    .upsert({ user_id: consumed.userId, updated_at: new Date().toISOString() }, { onConflict: 'user_id', ignoreDuplicates: true });

  // Remove the old reply keyboard (menus are gone).
  await sendTelegramMessage(chatId, BOT_LINKED, { remove_keyboard: true });
  return NextResponse.json({ ok: true });
}
