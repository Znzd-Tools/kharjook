import { NextResponse } from 'next/server';
import { processEveningReminders } from '@/features/notifications/services/notification-center';
import { verifyCronSecret } from '@/features/notifications/api/auth-helpers';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** Daily 23:00 Tehran: "record today's expenses" (Telegram + app, per user switch). */
export async function GET(request: Request) {
  if (!verifyCronSecret(request)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  try {
    const r = await processEveningReminders();
    return NextResponse.json({ ok: true, expenseRemindersSent: r.sent, errors: r.errors });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
