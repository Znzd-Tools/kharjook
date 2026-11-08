import { NextResponse } from 'next/server';
import { processScheduledNotifications } from '@/features/notifications/services/dispatch-notifications';
import { processPushReminders } from '@/features/notifications/push/send-push';
import { verifyCronSecret } from '@/features/notifications/api/auth-helpers';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await processScheduledNotifications();
    // Web Push runs after Telegram and only when VAPID keys are set (S30).
    const push = await processPushReminders();
    return NextResponse.json({ ok: true, ...result, pushRemindersSent: push.sent, errors: [...result.errors, ...push.errors] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
