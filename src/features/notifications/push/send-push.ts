import webpush from 'web-push';
import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import { todayJalaaliInTimezone } from '@/shared/utils/jalali';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';
import { installmentRemainingAmount } from '@/features/deadlines/utils/installment-remaining';
import { loanAmountToToman } from '@/features/deadlines/utils/loan-amount';
import { installmentDaysUntilDue, TEHRAN_TIMEZONE } from '@/features/notifications/telegram/utils/format-debts-list';
import { formatTelegramMoney } from '@/features/notifications/telegram/utils/format-helpers';
import type { Check, CurrencyRate, Loan, LoanInstallment, Subscription } from '@/shared/types/domain';
import { buildPushReminders, settleRequest } from './reminders';
import { isOn } from '@/features/notifications/utils/notification-prefs';

/** Server only (service-role client). Web Push works only when the VAPID keys are set. Without them nothing runs. */
export function isPushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function setup() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? 'mailto:admin@kharjook.app',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  configured = true;
}

interface PushRow { id: string; endpoint: string; p256dh: string; auth: string }

export interface PushResult {
  ok: boolean;
  /** HTTP status from the push service (FCM / Apple / Mozilla), if any. */
  status: number | null;
  message: string | null;
}

/** Send to one subscription. A dead one (404/410) is removed. */
export async function sendPushToRow(row: PushRow, payload: Record<string, unknown>): Promise<PushResult> {
  setup();
  try {
    const res = await webpush.sendNotification(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 12, urgency: 'high' }
    );
    return { ok: true, status: res.statusCode, message: null };
  } catch (e) {
    const err = e as { statusCode?: number; body?: string; message?: string };
    const status = err.statusCode ?? null;
    if (status === 404 || status === 410) await createSupabaseAdminClient().from('push_subscriptions').delete().eq('id', row.id);
    console.error('push failed', status, err.body ?? err.message);
    return { ok: false, status, message: (err.body ?? err.message ?? '').slice(0, 200) };
  }
}

/** Send one payload to every device of a user. Dead subscriptions are removed. */
export async function sendPushToUser(userId: string, payload: Record<string, unknown>): Promise<number> {
  if (!isPushConfigured()) return 0;
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', userId);
  let sent = 0;
  for (const row of (data ?? []) as PushRow[]) if ((await sendPushToRow(row, payload)).ok) sent++;
  return sent;
}

/** Test push to one device of a user (by endpoint). */
export async function sendTestPush(userId: string, endpoint: string): Promise<PushResult> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)
    .eq('endpoint', endpoint)
    .maybeSingle();
  if (!data) return { ok: false, status: null, message: 'not_saved' };
  return sendPushToRow(data as PushRow, {
    title: 'خرجوک',
    body: `اعلان آزمایشی · ${new Date().toLocaleTimeString('fa-IR', { timeZone: 'Asia/Tehran' })}`,
    url: '/settings',
    tag: 'push-test',
  });
}

/** Cron step: "due today / tomorrow" pushes with a one-tap "پرداخت شد". */
export async function processPushReminders(): Promise<{ sent: number; errors: string[] }> {
  if (!isPushConfigured()) return { sent: 0, errors: [] };
  const admin = createSupabaseAdminClient();
  const errors: string[] = [];
  let sent = 0;
  const { data: subs } = await admin.from('push_subscriptions').select('user_id');
  const userIds = Array.from(new Set(((subs ?? []) as { user_id: string }[]).map((s) => s.user_id)));
  const { data: settingsRows } = userIds.length
    ? await admin.from('notification_settings').select('user_id, channels').in('user_id', userIds)
    : { data: [] };
  const channelsOf = (id: string) => ((settingsRows ?? []) as { user_id: string; channels: unknown }[]).find((r) => r.user_id === id)?.channels ?? {};
  const today = todayJalaaliInTimezone(TEHRAN_TIMEZONE);
  const daysUntil = (d: string) => installmentDaysUntilDue(d, today);

  for (const userId of userIds) {
    try {
      const [checks, installments, subscriptions, rates] = await Promise.all([
        admin.from('checks').select('*').eq('user_id', userId).eq('status', 'pending').is('deleted_at', null),
        admin.from('loan_installments').select('*').eq('user_id', userId).eq('is_paid', false),
        admin.from('subscriptions').select('*').eq('user_id', userId).eq('status', 'active').is('deleted_at', null),
        admin.from('currency_rates').select('*').eq('user_id', userId),
      ]);
      const rateRows = (rates.data ?? []) as CurrencyRate[];
      const inst = (installments.data ?? []) as LoanInstallment[];
      const loanIds = Array.from(new Set(inst.map((i) => i.loan_id)));
      const { data: loans } = loanIds.length
        ? await admin.from('loans').select('*').in('id', loanIds).is('deleted_at', null)
        : { data: [] };
      const loanById = new Map(((loans ?? []) as Loan[]).map((l) => [l.id, l]));
      const assetIds = Array.from(new Set([...loanById.values()].map((l) => l.asset_id).filter((id): id is string => !!id)));
      const { data: assetRows } = assetIds.length
        ? await admin.from('assets').select('id, price_toman').in('id', assetIds)
        : { data: [] as { id: string; price_toman: number }[] };
      const assetsById = new Map(((assetRows ?? []) as { id: string; price_toman: number }[]).map((a) => [a.id, { price_toman: Number(a.price_toman) }]));
      const money = (toman: number) => formatTelegramMoney(toman, 'TOMAN');

      const ch = channelsOf(userId);
      const reminders = buildPushReminders({
        daysUntil,
        prefs: {
          dueToday: {
            check: isOn(ch, 'due_today.check', 'push'),
            installment: isOn(ch, 'due_today.installment', 'push'),
            subscription: isOn(ch, 'due_today.subscription', 'push'),
          },
          advance: isOn(ch, 'advance', 'push'),
        },
        checks: ((checks.data ?? []) as Check[]).map((c) => ({
          id: c.id, title: c.title, due_date_string: c.due_date_string, wallet_id: c.wallet_id,
          amountLabel: money(c.amount * tomanPerUnit(c.currency, rateRows)),
          reminderDays: c.reminder_days_before ?? [2],
        })),
        installments: inst.flatMap((i) => {
          const loan = loanById.get(i.loan_id);
          if (!loan) return [];
          return [{
            id: i.id, loanTitle: loan.title, due_date_string: i.due_date_string,
            reminderDays: loan.reminder_days_before ?? [2],
            amountLabel: money(loanAmountToToman(installmentRemainingAmount(i), loan, rateRows, assetsById)),
          }];
        }),
        subscriptions: ((subscriptions.data ?? []) as Subscription[]).map((s) => ({
          id: s.id, platform: s.platform, next_due_date_string: s.next_due_date_string, wallet_id: s.wallet_id,
          amountLabel: money(s.amount * tomanPerUnit(s.currency, rateRows)),
          reminderDays: s.reminder_days_before ?? [2],
        })),
      });

      for (const r of reminders) {
        const { data: done } = await admin
          .from('notification_deliveries')
          .select('id')
          .eq('user_id', userId)
          .eq('kind', 'push_reminder')
          .eq('dedup_key', r.key)
          .maybeSingle();
        if (done) continue;
        const n = await sendPushToUser(userId, {
          title: r.title,
          body: r.body,
          tag: r.key,
          url: '/deadlines',
          settle: settleRequest(r),
        });
        if (n > 0) {
          await admin.from('notification_deliveries').insert({ user_id: userId, kind: 'push_reminder', dedup_key: r.key });
          sent++;
        }
      }
    } catch (e) {
      errors.push(`push ${userId}: ${(e as Error).message}`);
    }
  }
  return { sent, errors };
}
