import { NextResponse } from 'next/server';
import { processScheduledNotifications } from '@/features/notifications/services/dispatch-notifications';
import { processPushReminders } from '@/features/notifications/push/send-push';
import { processPushOnlyCapAlerts } from '@/features/notifications/services/notification-center';
import { verifyCronSecret } from '@/features/notifications/api/auth-helpers';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Daily jobs (Vercel cron, Tehran time):
 *  - 10:00 (default): due today + "N days before" (Telegram + push), reports,
 *    caps, price refresh (+ "prices updated").
 *  The 23:00 expense reminder is /api/cron/evening.
 */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const result = await processScheduledNotifications();
    // Web Push runs after Telegram and only when VAPID keys are set.
    const push = await processPushReminders();
    await processPushOnlyCapAlerts().catch((e) => push.errors.push(`push-caps:${(e as Error).message}`));
    return NextResponse.json({ ok: true, ...result, pushRemindersSent: push.sent, errors: [...result.errors, ...push.errors] });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
