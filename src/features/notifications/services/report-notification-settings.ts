import { createSupabaseAdminClient } from '@/shared/lib/supabase/admin';
import type { NotificationReportInterval } from '@/shared/types/domain';

export interface ReportNotificationSettings {
  report_enabled: boolean;
  report_interval: NotificationReportInterval;
  report_day_of_week: number;
  show_portfolio_irt: boolean;
  show_portfolio_usd: boolean;
  show_cashflow_irt: boolean;
  show_cashflow_usd: boolean;
}

export const DEFAULT_REPORT_SETTINGS: ReportNotificationSettings = {
  report_enabled: false,
  report_interval: 'daily',
  report_day_of_week: 0,
  show_portfolio_irt: true,
  show_portfolio_usd: true,
  show_cashflow_irt: true,
  show_cashflow_usd: true,
};

export async function loadReportNotificationSettings(
  userId: string
): Promise<ReportNotificationSettings> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from('notification_settings')
    .select(
      'report_enabled, report_interval, report_day_of_week, show_portfolio_irt, show_portfolio_usd, show_cashflow_irt, show_cashflow_usd'
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (!data) return DEFAULT_REPORT_SETTINGS;

  const row = data as Partial<ReportNotificationSettings>;
  return {
    report_enabled: row.report_enabled ?? false,
    report_interval: row.report_interval ?? 'daily',
    report_day_of_week: row.report_day_of_week ?? 0,
    show_portfolio_irt: row.show_portfolio_irt ?? true,
    show_portfolio_usd: row.show_portfolio_usd ?? true,
    show_cashflow_irt: row.show_cashflow_irt ?? true,
    show_cashflow_usd: row.show_cashflow_usd ?? true,
  };
}

export async function updateReportNotificationSettings(
  userId: string,
  patch: Partial<Pick<ReportNotificationSettings, 'report_enabled' | 'report_interval'>>
): Promise<ReportNotificationSettings> {
  const admin = createSupabaseAdminClient();
  const current = await loadReportNotificationSettings(userId);
  const next = { ...current, ...patch };

  const { error } = await admin
    .from('notification_settings')
    .update({
      report_enabled: next.report_enabled,
      report_interval: next.report_interval,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  if (error) throw error;
  return next;
}
