import { NextResponse } from 'next/server';
import { setTelegramWebhook } from '@/features/notifications/telegram/utils/telegram-client';

export const runtime = 'nodejs';

function unauthorized() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}

/** Re-register webhook with message + callback_query updates. */
export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret) {
    const header = request.headers.get('x-telegram-webhook-secret');
    if (header !== secret) return unauthorized();
  }

  const configuredUrl = process.env.TELEGRAM_WEBHOOK_URL?.trim();
  const origin = new URL(request.url).origin;
  const webhookUrl = configuredUrl || `${origin}/api/telegram/webhook`;

  await setTelegramWebhook(webhookUrl);
  return NextResponse.json({ ok: true, webhookUrl });
}
