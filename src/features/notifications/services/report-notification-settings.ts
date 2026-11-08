import type { NotificationReportInterval } from '@/shared/types/domain';

export interface ReportNotificationSettings {
  /** From the notification center: report → Telegram switch. */
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
