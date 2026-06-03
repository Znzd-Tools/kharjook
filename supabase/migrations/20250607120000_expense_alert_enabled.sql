-- Telegram alert when an expense transaction is recorded

ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS expense_alert_enabled boolean NOT NULL DEFAULT true;
