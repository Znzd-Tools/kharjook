import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/shared/lib/supabase/server';
import { requireAuthUser, unauthorized } from '@/features/notifications/api/auth-helpers';
import { NOTIF_KEYS, isOn, sanitizeChannels, type NotifChannels } from '@/features/notifications/utils/notification-prefs';
import { isPushConfigured } from '@/features/notifications/push/send-push';

export const runtime = 'nodejs';

const REPORT_COLS = 'report_interval, report_day_of_week, show_cashflow_irt, show_cashflow_usd, show_portfolio_irt, show_portfolio_usd';
type Report = {
  report_interval: 'daily' | 'weekly';
  report_day_of_week: number;
  show_cashflow_irt: boolean;
  show_cashflow_usd: boolean;
  show_portfolio_irt: boolean;
  show_portfolio_usd: boolean;
};
const REPORT_DEFAULTS: Report = {
  report_interval: 'daily',
  report_day_of_week: 0,
  show_cashflow_irt: true,
  show_cashflow_usd: true,
  show_portfolio_irt: true,
  show_portfolio_usd: true,
};

const resolved = (raw: unknown) =>
  Object.fromEntries(NOTIF_KEYS.map((k) => [k, { telegram: isOn(raw, k, 'telegram'), push: isOn(raw, k, 'push') }]));

function cleanReport(input: unknown): Partial<Report> {
  if (!input || typeof input !== 'object') return {};
  const i = input as Record<string, unknown>;
  const out: Partial<Report> = {};
  if (i.report_interval === 'daily' || i.report_interval === 'weekly') out.report_interval = i.report_interval;
  if (Number.isInteger(i.report_day_of_week) && (i.report_day_of_week as number) >= 0 && (i.report_day_of_week as number) <= 6)
    out.report_day_of_week = i.report_day_of_week as number;
  for (const k of ['show_cashflow_irt', 'show_cashflow_usd', 'show_portfolio_irt', 'show_portfolio_usd'] as const)
    if (typeof i[k] === 'boolean') out[k] = i[k] as boolean;
  return out;
}

/** Notification settings page: switches per notification, channel status, report options. */
export async function GET() {
  const user = await requireAuthUser();
  if (!user) return unauthorized();
  const supabase = await createSupabaseServerClient();
  const [settings, conn] = await Promise.all([
    supabase.from('notification_settings').select(`channels, ${REPORT_COLS}`).eq('user_id', user.id).maybeSingle(),
    supabase.from('telegram_connections').select('is_active, telegram_username').eq('user_id', user.id).maybeSingle(),
  ]);
  const row = (settings.data ?? {}) as Partial<Report> & { channels?: unknown };
  const c = conn.data as { is_active?: boolean; telegram_username?: string | null } | null;
  return NextResponse.json({
    channels: resolved(row.channels),
    telegram: { connected: Boolean(c?.is_active), username: c?.telegram_username ?? null },
    push: { configured: isPushConfigured() },
    report: { ...REPORT_DEFAULTS, ...Object.fromEntries(Object.entries(row).filter(([k, v]) => k !== 'channels' && v != null)) },
  });
}

export async function PUT(request: Request) {
  const user = await requireAuthUser();
  if (!user) return unauthorized();
  const body = (await request.json().catch(() => ({}))) as { channels?: unknown; report?: unknown };
  const patch = sanitizeChannels(body.channels);
  const report = cleanReport(body.report);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('notification_settings').select('channels').eq('user_id', user.id).maybeSingle();
  const current = ((data as { channels?: NotifChannels } | null)?.channels ?? {}) as NotifChannels;
  const next: NotifChannels = { ...current };
  for (const [k, v] of Object.entries(patch) as [keyof NotifChannels, NotifChannels[keyof NotifChannels]][]) next[k] = { ...current[k], ...v };
  const { error } = await supabase
    .from('notification_settings')
    .upsert({ user_id: user.id, channels: next, ...report, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Save failed' }, { status: 500 });
  }
  return NextResponse.json({ channels: resolved(next) });
}
