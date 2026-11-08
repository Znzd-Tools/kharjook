/**
 * Notification center jobs that go to BOTH channels (Telegram + app push),
 * each switched per user in Settings (notification_settings.channels).
 *  - price_update: after the daily price refresh (10:00 job)
 *  - expense_reminder: "did you record today's expenses?" (23:00 job)
 */
import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import { formatJalaali, todayJalaaliInTimezone } from '@/shared/utils/jalali';
import type { NotificationDeliveryKind, TelegramConnection } from '@/shared/types/domain';
import { sendTelegramMessage } from '@/features/notifications/telegram/utils/telegram-client';
import { formatTelegramMoney } from '@/features/notifications/telegram/utils/format-helpers';
import { isPushConfigured, sendPushToUser } from '@/features/notifications/push/send-push';
import { isOn, type NotifKey } from '@/features/notifications/utils/notification-prefs';
import { processCategoryCapAlertsForUser } from '@/features/categories/services/category-cap-alerts';

const TEHRAN = 'Asia/Tehran';
const fa = (n: number) => n.toLocaleString('fa-IR');

interface UserCtx {
  channels: unknown;
  connection: TelegramConnection | null;
  hasPush: boolean;
}

async function loadUsers(userIds?: string[]): Promise<Map<string, UserCtx>> {
  const admin = createSupabaseAdminClient();
  const settingsQ = admin.from('notification_settings').select('user_id, channels');
  const connQ = admin.from('telegram_connections').select('*').eq('is_active', true);
  const pushQ = admin.from('push_subscriptions').select('user_id');
  const [settings, conns, pushes] = await Promise.all([
    userIds ? settingsQ.in('user_id', userIds) : settingsQ,
    userIds ? connQ.in('user_id', userIds) : connQ,
    userIds ? pushQ.in('user_id', userIds) : pushQ,
  ]);
  const ids = new Set<string>(userIds ?? []);
  for (const r of (settings.data ?? []) as { user_id: string }[]) ids.add(r.user_id);
  for (const r of (conns.data ?? []) as { user_id: string }[]) ids.add(r.user_id);
  for (const r of (pushes.data ?? []) as { user_id: string }[]) ids.add(r.user_id);
  const out = new Map<string, UserCtx>();
  for (const id of ids) {
    const st = ((settings.data ?? []) as { user_id: string; channels: unknown }[]).find((r) => r.user_id === id);
    out.set(id, {
      channels: st?.channels ?? {},
      connection: ((conns.data ?? []) as TelegramConnection[]).find((c) => c.user_id === id) ?? null,
      hasPush: ((pushes.data ?? []) as { user_id: string }[]).some((p) => p.user_id === id),
    });
  }
  return out;
}

async function once(userId: string, kind: NotificationDeliveryKind, key: string): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from('notification_deliveries').select('id').eq('user_id', userId).eq('kind', kind).eq('dedup_key', key).maybeSingle();
  if (data) return false;
  await admin.from('notification_deliveries').insert({ user_id: userId, kind, dedup_key: key });
  return true;
}

/** Send one message to the channels the user turned on for `key`. */
async function deliver(
  userId: string,
  ctx: UserCtx,
  key: NotifKey,
  msg: { telegram: string; title: string; body: string; url: string; tag: string }
): Promise<number> {
  let sent = 0;
  if (ctx.connection && isOn(ctx.channels, key, 'telegram')) {
    try {
      await sendTelegramMessage(ctx.connection.telegram_chat_id, msg.telegram);
      sent++;
    } catch (e) {
      console.error('telegram', key, (e as Error).message);
    }
  }
  if (ctx.hasPush && isPushConfigured() && isOn(ctx.channels, key, 'push')) {
    sent += await sendPushToUser(userId, { title: msg.title, body: msg.body, url: msg.url, tag: msg.tag });
  }
  return sent;
}

export async function notifyPriceUpdates(
  perUser: { userId: string; updatedCount: number; usdRate: number; failedProviders: string[] }[]
): Promise<number> {
  if (perUser.length === 0) return 0;
  const users = await loadUsers(perUser.map((p) => p.userId));
  const today = formatJalaali(todayJalaaliInTimezone(TEHRAN));
  let sent = 0;
  for (const r of perUser) {
    const ctx = users.get(r.userId);
    if (!ctx) continue;
    const wants = isOn(ctx.channels, 'price_update', 'telegram') || isOn(ctx.channels, 'price_update', 'push');
    if (!wants || !(await once(r.userId, 'price_update', today))) continue;
    const failed = r.failedProviders.length ? ` · منبع ناموفق: ${r.failedProviders.join('، ')}` : '';
    const usd = r.usdRate > 0 ? ` · دلار ${formatTelegramMoney(r.usdRate, 'TOMAN')}` : '';
    const line = `${fa(r.updatedCount)} قیمت به‌روز شد${usd}${failed}`;
    sent += await deliver(r.userId, ctx, 'price_update', {
      telegram: `💹 به‌روزرسانی روزانه قیمت‌ها انجام شد\n${line}`,
      title: 'قیمت‌ها به‌روز شد',
      body: line,
      url: '/prices',
      tag: `price:${today}`,
    });
  }
  return sent;
}

/** 23:00 Tehran: remind to record today's expenses. */
export async function processEveningReminders(): Promise<{ sent: number; errors: string[] }> {
  const users = await loadUsers();
  const today = formatJalaali(todayJalaaliInTimezone(TEHRAN));
  const admin = createSupabaseAdminClient();
  const errors: string[] = [];
  let sent = 0;
  for (const [userId, ctx] of users) {
    const wants = isOn(ctx.channels, 'expense_reminder', 'telegram') || isOn(ctx.channels, 'expense_reminder', 'push');
    if (!wants) continue;
    try {
      if (!(await once(userId, 'expense_reminder', today))) continue;
      const { data } = await admin
        .from('transactions')
        .select('amount_toman_at_time')
        .eq('user_id', userId)
        .eq('type', 'EXPENSE')
        .eq('date_string', today);
      const rows = (data ?? []) as { amount_toman_at_time: number | null }[];
      const total = rows.reduce((s, r) => s + (Number(r.amount_toman_at_time) || 0), 0);
      const body =
        rows.length > 0
          ? `امروز ${fa(rows.length)} هزینه ثبت کردی · جمع ${formatTelegramMoney(total, 'TOMAN')}. چیزی جا نمانده؟`
          : 'امروز هیچ هزینه‌ای ثبت نکردی. اگر خرجی داشتی، همین حالا ثبتش کن.';
      sent += await deliver(userId, ctx, 'expense_reminder', {
        telegram: `🌙 ${body}`,
        title: 'ثبت هزینه‌های امروز',
        body,
        url: '/transactions/new?type=EXPENSE',
        tag: `expense:${today}`,
      });
    } catch (e) {
      errors.push(`${userId}:${(e as Error).message}`);
    }
  }
  return { sent, errors };
}

/**
 * Cap alerts for users who get them only in the app (the Telegram loop in
 * dispatch-notifications already sends both channels when Telegram is on).
 */
export async function processPushOnlyCapAlerts(): Promise<number> {
  if (!isPushConfigured()) return 0;
  const users = await loadUsers();
  let sent = 0;
  for (const [userId, ctx] of users) {
    if (!ctx.hasPush || !isOn(ctx.channels, 'cap_alert', 'push')) continue;
    if (ctx.connection && isOn(ctx.channels, 'cap_alert', 'telegram')) continue;
    try {
      sent += await processCategoryCapAlertsForUser(userId, null, true);
    } catch (e) {
      console.error('push cap alerts', userId, (e as Error).message);
    }
  }
  return sent;
}
