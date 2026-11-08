import type {
  Asset,
  Category,
  Check,
  CurrencyRate,
  Loan,
  LoanInstallment,
  NotificationDeliveryKind,
  NotificationSettings,
  Subscription,
  TelegramConnection,
  Transaction,
  Wallet,
} from '@/shared/types/domain';
import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import { installmentRemainingAmount } from '@/features/deadlines/utils/installment-remaining';
import { loanAmountToToman } from '@/features/deadlines/utils/loan-amount';
import { buildUserNotificationSnapshot } from '@/features/notifications/utils/build-user-snapshot';
import { formatScheduledReportMessage } from '@/features/notifications/telegram/utils/format-scheduled-report';
import { processCategoryCapAlertsForUser } from '@/features/categories/services/category-cap-alerts';
import {
  DEFAULT_REPORT_SETTINGS,
  type ReportNotificationSettings,
} from '@/features/notifications/services/report-notification-settings';
import { formatJalaali, jalaaliWeekday, todayJalaaliInTimezone } from '@/shared/utils/jalali';
import {
  formatDebtsListMessage,
  buildInstallmentPayInlineKeyboard,
  installmentDaysUntilDue,
  TEHRAN_TIMEZONE,
  type CheckListItem,
  type DebtListItem,
  type DebtsListScope,
  type SubscriptionListItem,
} from '@/features/notifications/telegram/utils/format-debts-list';
import {
  sendTelegramInlineMessage,
  sendTelegramMessage,
  TelegramSendError,
  type TelegramInlineMarkup,
  type TelegramReplyMarkup,
} from '@/features/notifications/telegram/utils/telegram-client';
import { tomanPerUnit } from '@/shared/utils/currency-conversion';
import { periodContaining } from '@/shared/utils/period';
import { processAutoPriceRefresh } from '@/features/notifications/services/server-price-refresh';
import {
  DEFAULT_NOTIFICATION_SETTINGS as BOT_DEFAULT_NOTIFICATION_SETTINGS,
  loadNotificationEnabled,
  type BotNotificationSettings,
} from '@/features/notifications/services/bot-notification-settings';
import { fetchAllUserTransactions } from '@/shared/lib/supabase/fetch-all-transactions';
import { isOn } from '@/features/notifications/utils/notification-prefs';
import { notifyPriceUpdates } from '@/features/notifications/services/notification-center';

/** Defaults for new rows. */
export const DEFAULT_NOTIFICATION_SETTINGS: Omit<
  NotificationSettings,
  'user_id' | 'updated_at'
> = {
  enabled: BOT_DEFAULT_NOTIFICATION_SETTINGS.enabled,
  price_alert_enabled: BOT_DEFAULT_NOTIFICATION_SETTINGS.price_alert_enabled,
  expense_alert_enabled: BOT_DEFAULT_NOTIFICATION_SETTINGS.expense_alert_enabled,
  report_enabled: DEFAULT_REPORT_SETTINGS.report_enabled,
  report_interval: DEFAULT_REPORT_SETTINGS.report_interval,
  report_day_of_week: DEFAULT_REPORT_SETTINGS.report_day_of_week,
  show_portfolio_irt: DEFAULT_REPORT_SETTINGS.show_portfolio_irt,
  show_portfolio_usd: DEFAULT_REPORT_SETTINGS.show_portfolio_usd,
  show_cashflow_irt: DEFAULT_REPORT_SETTINGS.show_cashflow_irt,
  show_cashflow_usd: DEFAULT_REPORT_SETTINGS.show_cashflow_usd,
};

export type { BotNotificationSettings };

export { loadNotificationEnabled };

async function loadUserData(userId: string) {
  const admin = createSupabaseAdminClient();
  const [
    { data: transactions },
    { data: categories },
    { data: wallets },
    { data: assets },
    { data: currencyRates },
  ] = await Promise.all([
    fetchAllUserTransactions(admin, userId),
    admin.from('categories').select('*').eq('user_id', userId),
    admin.from('wallets').select('*').eq('user_id', userId).is('archived_at', null),
    admin.from('assets').select('*').eq('user_id', userId),
    admin.from('currency_rates').select('*').eq('user_id', userId),
  ]);

  return {
    transactions: (transactions ?? []) as Transaction[],
    categories: (categories ?? []) as Category[],
    wallets: (wallets ?? []) as Wallet[],
    assets: (assets ?? []) as Asset[],
    currencyRates: (currencyRates ?? []) as CurrencyRate[],
  };
}

async function loadUnpaidDebtItems(userId: string): Promise<DebtListItem[]> {
  const today = todayJalaaliInTimezone(TEHRAN_TIMEZONE);
  const admin = createSupabaseAdminClient();
  const { data: installments } = await admin
    .from('loan_installments')
    .select('*')
    .eq('user_id', userId)
    .eq('is_paid', false)
    .order('due_date_string', { ascending: true });

  if (!installments?.length) return [];

  const loanIds = Array.from(new Set(installments.map((i) => i.loan_id)));
  const [{ data: loans }, { data: currencyRates }] = await Promise.all([
    admin.from('loans').select('*').in('id', loanIds).is('deleted_at', null),
    admin.from('currency_rates').select('*').eq('user_id', userId),
  ]);

  const loanMap = new Map(((loans ?? []) as Loan[]).map((l) => [l.id, l]));
  const rates = (currencyRates ?? []) as CurrencyRate[];
  const assetIds = Array.from(
    new Set(
      ((loans ?? []) as Loan[])
        .map((l) => l.asset_id)
        .filter((id): id is string => !!id)
    )
  );
  const { data: assetRows } =
    assetIds.length > 0
      ? await admin.from('assets').select('id, price_toman').in('id', assetIds)
      : { data: [] as Array<{ id: string; price_toman: number }> };
  const assetsById = new Map(
    (assetRows ?? []).map((a) => [a.id, { price_toman: Number(a.price_toman) }])
  );

  const items: DebtListItem[] = [];
  for (const row of installments as LoanInstallment[]) {
    const loan = loanMap.get(row.loan_id);
    if (!loan) continue;
    const daysUntil = installmentDaysUntilDue(row.due_date_string, today);
    if (daysUntil == null) continue;
    items.push({
      installmentId: row.id,
      loanId: row.loan_id,
      loanTitle: loan.title,
      dueDateString: row.due_date_string,
      amountToman: loanAmountToToman(
        installmentRemainingAmount(row),
        loan,
        rates,
        assetsById
      ),
      daysUntilDue: daysUntil,
      reminderDaysBefore: loan.reminder_days_before ?? [],
    });
  }
  return items;
}

async function loadPendingChecks(userId: string): Promise<CheckListItem[]> {
  const today = todayJalaaliInTimezone(TEHRAN_TIMEZONE);
  const admin = createSupabaseAdminClient();
  const { data: rows } = await admin
    .from('checks')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .is('deleted_at', null)
    .order('due_date_string', { ascending: true });

  if (!rows?.length) return [];

  const { data: currencyRates } = await admin
    .from('currency_rates')
    .select('*')
    .eq('user_id', userId);
  const rates = (currencyRates ?? []) as CurrencyRate[];

  const items: CheckListItem[] = [];
  for (const row of rows as Check[]) {
    const daysUntil = installmentDaysUntilDue(row.due_date_string, today);
    if (daysUntil == null) continue;
    const rate = tomanPerUnit(row.currency, rates);
    items.push({
      checkId: row.id,
      title: row.title,
      dueDateString: row.due_date_string,
      amountToman: row.amount * rate,
      daysUntilDue: daysUntil,
      bankName: row.bank_name,
      reminderDaysBefore: row.reminder_days_before ?? [2],
    });
  }
  return items;
}

async function loadUpcomingSubscriptions(userId: string): Promise<SubscriptionListItem[]> {
  const today = todayJalaaliInTimezone(TEHRAN_TIMEZONE);
  const admin = createSupabaseAdminClient();
  const { data: rows } = await admin
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('next_due_date_string', { ascending: true });

  if (!rows?.length) return [];

  const { data: currencyRates } = await admin
    .from('currency_rates')
    .select('*')
    .eq('user_id', userId);
  const rates = (currencyRates ?? []) as CurrencyRate[];

  const items: SubscriptionListItem[] = [];
  for (const row of rows as Subscription[]) {
    const daysUntil = installmentDaysUntilDue(row.next_due_date_string, today);
    if (daysUntil == null) continue;
    const rate = tomanPerUnit(row.currency, rates);
    items.push({
      subscriptionId: row.id,
      platform: row.platform,
      dueDateString: row.next_due_date_string,
      amountToman: row.amount * rate,
      daysUntilDue: daysUntil,
      reminderDaysBefore: row.reminder_days_before ?? [],
    });
  }
  return items;
}

async function wasDelivered(
  userId: string,
  kind: NotificationDeliveryKind,
  dedupKey: string
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('notification_deliveries')
    .select('id')
    .eq('user_id', userId)
    .eq('kind', kind)
    .eq('dedup_key', dedupKey)
    .maybeSingle();
  return !!data;
}

async function markDelivered(
  userId: string,
  kind: NotificationDeliveryKind,
  dedupKey: string
): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from('notification_deliveries').insert({
    user_id: userId,
    kind,
    dedup_key: dedupKey,
  });
}

async function markConnectionInactive(userId: string): Promise<void> {
  const admin = createSupabaseAdminClient();
  await admin.from('telegram_connections').update({ is_active: false }).eq('user_id', userId);
}

async function sendTelegramToConnection(
  connection: TelegramConnection,
  text: string,
  replyMarkup?: TelegramReplyMarkup
): Promise<void> {
  try {
    await sendTelegramMessage(connection.telegram_chat_id, text, replyMarkup);
  } catch (err) {
    if (err instanceof TelegramSendError && err.blocked) {
      await markConnectionInactive(connection.user_id);
    }
    throw err;
  }
}

async function sendTelegramInlineToConnection(
  connection: TelegramConnection,
  text: string,
  inlineMarkup: TelegramInlineMarkup
): Promise<void> {
  try {
    await sendTelegramInlineMessage(connection.telegram_chat_id, text, inlineMarkup);
  } catch (err) {
    if (err instanceof TelegramSendError && err.blocked) {
      await markConnectionInactive(connection.user_id);
    }
    throw err;
  }
}

/** Daily cron at 09:00 Tehran — today's installments only, skip if none. */
export async function sendDebtsListForUser(
  userId: string,
  connection: TelegramConnection,
  options?: { skipDedup?: boolean; todayOnly?: boolean; channels?: unknown }
): Promise<boolean> {
  const today = todayJalaaliInTimezone(TEHRAN_TIMEZONE);
  const dedupKey = formatJalaali(today);
  const scope: DebtsListScope = options?.todayOnly ? 'today' : 'all';

  if (!options?.skipDedup && (await wasDelivered(userId, 'loan_reminder', dedupKey))) {
    return false;
  }

  let items = await loadUnpaidDebtItems(userId);
  let checks = await loadPendingChecks(userId);
  let subscriptions = await loadUpcomingSubscriptions(userId);
  if (options?.todayOnly) {
    // Notification center: each type can be switched off for Telegram.
    const ch = options.channels;
    items = isOn(ch, 'due_today.installment', 'telegram') ? items.filter((item) => item.daysUntilDue === 0) : [];
    checks = isOn(ch, 'due_today.check', 'telegram') ? checks.filter((item) => item.daysUntilDue === 0) : [];
    subscriptions = isOn(ch, 'due_today.subscription', 'telegram') ? subscriptions.filter((item) => item.daysUntilDue === 0) : [];
    if (items.length === 0 && checks.length === 0 && subscriptions.length === 0) return false;
  }

  const text = formatDebtsListMessage(items, scope, checks, subscriptions);
  const inline =
    options?.todayOnly && items.length > 0 ? buildInstallmentPayInlineKeyboard(items) : null;

  if (inline) {
    await sendTelegramInlineToConnection(connection, text, inline);
  } else {
    await sendTelegramToConnection(connection, text);
  }

  if (!options?.skipDedup) {
    await markDelivered(userId, 'loan_reminder', dedupKey);
  }
  return true;
}

/** Daily cron — advance reminders per loan/subscription `reminder_days_before` offsets. */
export async function sendAdvanceLoanRemindersForUser(
  userId: string,
  connection: TelegramConnection
): Promise<boolean> {
  const allItems = await loadUnpaidDebtItems(userId);
  const allSubscriptions = await loadUpcomingSubscriptions(userId);
  const allChecks = await loadPendingChecks(userId);
  const dueToday: DebtListItem[] = [];
  const dueSubscriptions: SubscriptionListItem[] = [];
  const dueChecks: CheckListItem[] = [];

  for (const item of allChecks) {
    if (item.daysUntilDue <= 0) continue;
    if (!(item.reminderDaysBefore ?? []).includes(item.daysUntilDue)) continue;
    if (await wasDelivered(userId, 'loan_reminder', `advance:chk:${item.checkId}:${item.daysUntilDue}`)) continue;
    dueChecks.push(item);
  }

  for (const item of allItems) {
    if (item.daysUntilDue <= 0) continue;
    if (!item.reminderDaysBefore.includes(item.daysUntilDue)) continue;

    const dedupKey = `advance:${item.installmentId}:${item.daysUntilDue}`;
    if (await wasDelivered(userId, 'loan_reminder', dedupKey)) continue;

    dueToday.push(item);
  }

  for (const item of allSubscriptions) {
    if (item.daysUntilDue <= 0) continue;
    if (!item.reminderDaysBefore.includes(item.daysUntilDue)) continue;

    const dedupKey = `advance:sub:${item.subscriptionId}:${item.daysUntilDue}`;
    if (await wasDelivered(userId, 'loan_reminder', dedupKey)) continue;

    dueSubscriptions.push(item);
  }

  if (dueToday.length === 0 && dueSubscriptions.length === 0 && dueChecks.length === 0) return false;

  const text = formatDebtsListMessage(dueToday, 'advance', dueChecks, dueSubscriptions);
  await sendTelegramToConnection(connection, text);

  for (const item of dueChecks) {
    await markDelivered(userId, 'loan_reminder', `advance:chk:${item.checkId}:${item.daysUntilDue}`);
  }

  for (const item of dueToday) {
    await markDelivered(userId, 'loan_reminder', `advance:${item.installmentId}:${item.daysUntilDue}`);
  }
  for (const item of dueSubscriptions) {
    await markDelivered(
      userId,
      'loan_reminder',
      `advance:sub:${item.subscriptionId}:${item.daysUntilDue}`
    );
  }
  return true;
}

function reportDedupKey(
  interval: ReportNotificationSettings['report_interval'],
  today = todayJalaaliInTimezone(TEHRAN_TIMEZONE)
): string {
  if (interval === 'weekly') {
    const weekStart = periodContaining('week', today);
    return `weekly:${formatJalaali(weekStart.start)}`;
  }
  return `daily:${formatJalaali(today)}`;
}

function shouldSendReportToday(settings: ReportNotificationSettings): boolean {
  if (!settings.report_enabled) return false;
  if (settings.report_interval === 'daily') return true;
  const today = todayJalaaliInTimezone(TEHRAN_TIMEZONE);
  return jalaaliWeekday(today) === settings.report_day_of_week;
}

export async function sendScheduledReportForUser(
  userId: string,
  connection: TelegramConnection,
  settings: ReportNotificationSettings,
  options?: { skipDedup?: boolean }
): Promise<boolean> {
  if (!shouldSendReportToday(settings)) return false;

  const hasContent =
    settings.show_cashflow_irt ||
    settings.show_cashflow_usd ||
    settings.show_portfolio_irt ||
    settings.show_portfolio_usd;
  if (!hasContent) return false;

  const dedupKey = reportDedupKey(settings.report_interval);
  if (!options?.skipDedup && (await wasDelivered(userId, 'daily_report', dedupKey))) {
    return false;
  }

  const data = await loadUserData(userId);
  const snapshot = buildUserNotificationSnapshot(data);
  const text = formatScheduledReportMessage({
    interval: settings.report_interval,
    snapshot,
    showPortfolioIrt: settings.show_portfolio_irt,
    showPortfolioUsd: settings.show_portfolio_usd,
    showCashflowIrt: settings.show_cashflow_irt,
    showCashflowUsd: settings.show_cashflow_usd,
  });

  await sendTelegramToConnection(connection, text);
  if (!options?.skipDedup) {
    await markDelivered(userId, 'daily_report', dedupKey);
  }
  return true;
}

/** Daily cron at 10:00 Tehran — due items, reminders, reports, caps, auto prices. */
export async function processScheduledNotifications(): Promise<{
  debtsDigestsSent: number;
  reportsDigestsSent: number;
  categoryCapAlertsSent: number;
  priceRefreshUsersProcessed: number;
  priceRefreshAssetsUpdated: number;
  errors: string[];
}> {
  const errors: string[] = [];

  const priceRefreshResult = await processAutoPriceRefresh();
  errors.push(...priceRefreshResult.errors);
  try {
    await notifyPriceUpdates(priceRefreshResult.perUser);
  } catch (err) {
    errors.push(`price-notify:${err instanceof Error ? err.message : String(err)}`);
  }

  const admin = createSupabaseAdminClient();
  const { data: connections } = await admin
    .from('telegram_connections')
    .select('*')
    .eq('is_active', true);

  const activeConnections = (connections ?? []) as TelegramConnection[];
  if (activeConnections.length === 0) {
    return {
      debtsDigestsSent: 0,
      reportsDigestsSent: 0,
      categoryCapAlertsSent: 0,
      priceRefreshUsersProcessed: priceRefreshResult.usersProcessed,
      priceRefreshAssetsUpdated: priceRefreshResult.assetsUpdated,
      errors,
    };
  }

  const userIds = activeConnections.map((conn) => conn.user_id);
  const { data: settingsRows } = await admin
    .from('notification_settings')
    .select(
      'user_id, enabled, channels, report_enabled, report_interval, report_day_of_week, show_portfolio_irt, show_portfolio_usd, show_cashflow_irt, show_cashflow_usd'
    )
    .in('user_id', userIds);

  const enabledByUser = new Map<string, boolean>();
  const channelsByUser = new Map<string, unknown>();
  const reportByUser = new Map<string, ReportNotificationSettings>();
  for (const row of settingsRows ?? []) {
    const settings = row as {
      user_id: string;
      enabled: boolean;
      channels?: unknown;
      report_enabled?: boolean;
      report_interval?: ReportNotificationSettings['report_interval'];
      report_day_of_week?: number;
      show_portfolio_irt?: boolean;
      show_portfolio_usd?: boolean;
      show_cashflow_irt?: boolean;
      show_cashflow_usd?: boolean;
    };
    enabledByUser.set(settings.user_id, settings.enabled);
    channelsByUser.set(settings.user_id, settings.channels);
    reportByUser.set(settings.user_id, {
      report_enabled: settings.report_enabled ?? DEFAULT_REPORT_SETTINGS.report_enabled,
      report_interval: settings.report_interval ?? DEFAULT_REPORT_SETTINGS.report_interval,
      report_day_of_week:
        settings.report_day_of_week ?? DEFAULT_REPORT_SETTINGS.report_day_of_week,
      show_portfolio_irt:
        settings.show_portfolio_irt ?? DEFAULT_REPORT_SETTINGS.show_portfolio_irt,
      show_portfolio_usd:
        settings.show_portfolio_usd ?? DEFAULT_REPORT_SETTINGS.show_portfolio_usd,
      show_cashflow_irt:
        settings.show_cashflow_irt ?? DEFAULT_REPORT_SETTINGS.show_cashflow_irt,
      show_cashflow_usd:
        settings.show_cashflow_usd ?? DEFAULT_REPORT_SETTINGS.show_cashflow_usd,
    });
  }

  let debtsDigestsSent = 0;
  let reportsDigestsSent = 0;
  let categoryCapAlertsSent = 0;

  for (const conn of activeConnections) {
    const enabled = enabledByUser.get(conn.user_id) ?? BOT_DEFAULT_NOTIFICATION_SETTINGS.enabled;
    if (enabled) {
      try {
        const sent = await sendDebtsListForUser(conn.user_id, conn, { todayOnly: true, channels: channelsByUser.get(conn.user_id) });
        if (sent) debtsDigestsSent += 1;
      } catch (err) {
        errors.push(
          `${conn.user_id}:debts:${err instanceof Error ? err.message : String(err)}`
        );
      }

      try {
        const sentAdvance = isOn(channelsByUser.get(conn.user_id), 'advance', 'telegram')
          ? await sendAdvanceLoanRemindersForUser(conn.user_id, conn)
          : false;
        if (sentAdvance) debtsDigestsSent += 1;
      } catch (err) {
        errors.push(
          `${conn.user_id}:debts-advance:${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    try {
      const sent = await processCategoryCapAlertsForUser(conn.user_id, conn);
      categoryCapAlertsSent += sent;
    } catch (err) {
      errors.push(
        `${conn.user_id}:caps:${err instanceof Error ? err.message : String(err)}`
      );
    }

    const reportSettings =
      reportByUser.get(conn.user_id) ?? DEFAULT_REPORT_SETTINGS;
    if (reportSettings.report_enabled) {
      try {
        const sent = await sendScheduledReportForUser(conn.user_id, conn, reportSettings);
        if (sent) reportsDigestsSent += 1;
      } catch (err) {
        errors.push(
          `${conn.user_id}:report:${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  return {
    debtsDigestsSent,
    reportsDigestsSent,
    categoryCapAlertsSent,
    priceRefreshUsersProcessed: priceRefreshResult.usersProcessed,
    priceRefreshAssetsUpdated: priceRefreshResult.assetsUpdated,
    errors,
  };
}


export { loadUnpaidDebtItems };
