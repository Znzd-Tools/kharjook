import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/shared/lib/supabase/server';
import { requireAuthUser, unauthorized } from '@/features/notifications/api/auth-helpers';
import { NOTIF_KEYS, isOn, sanitizeChannels, type NotifChannels } from '@/features/notifications/utils/notification-prefs';
import { isPushConfigured } from '@/features/notifications/push/send-push';

export const runtime = 'nodejs';

const resolved = (raw: unknown) =>
  Object.fromEntries(NOTIF_KEYS.map((k) => [k, { telegram: isOn(raw, k, 'telegram'), push: isOn(raw, k, 'push') }]));

/** Notification center: per notification, Telegram and app switches + channel status. */
export async function GET() {
  const user = await requireAuthUser();
  if (!user) return unauthorized();
  const supabase = await createSupabaseServerClient();
  const [settings, conn] = await Promise.all([
    supabase.from('notification_settings').select('channels, enabled').eq('user_id', user.id).maybeSingle(),
    supabase.from('telegram_connections').select('is_active').eq('user_id', user.id).maybeSingle(),
  ]);
  return NextResponse.json({
    channels: resolved((settings.data as { channels?: unknown } | null)?.channels),
    telegram: {
      connected: Boolean((conn.data as { is_active?: boolean } | null)?.is_active),
      enabled: (settings.data as { enabled?: boolean } | null)?.enabled ?? true,
    },
    push: { configured: isPushConfigured() },
  });
}

export async function PUT(request: Request) {
  const user = await requireAuthUser();
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as { channels?: unknown };
  const patch = sanitizeChannels(body.channels);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('notification_settings').select('channels').eq('user_id', user.id).maybeSingle();
  const current = ((data as { channels?: NotifChannels } | null)?.channels ?? {}) as NotifChannels;
  const next: NotifChannels = { ...current };
  for (const [k, v] of Object.entries(patch) as [keyof NotifChannels, NotifChannels[keyof NotifChannels]][]) next[k] = { ...current[k], ...v };
  const { error } = await supabase
    .from('notification_settings')
    .upsert({ user_id: user.id, channels: next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
  return NextResponse.json({ channels: resolved(next) });
}
