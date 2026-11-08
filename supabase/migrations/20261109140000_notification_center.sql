-- Notification center (Telegram + app push). Additive.
-- 1) Cheques get their own "remind N days before" like loans and subscriptions.
ALTER TABLE public.checks ADD COLUMN IF NOT EXISTS reminder_days_before integer[] NOT NULL DEFAULT '{2}';
-- 2) New items remind 2 days before by default.
ALTER TABLE public.loans ALTER COLUMN reminder_days_before SET DEFAULT '{2}';
ALTER TABLE public.subscriptions ALTER COLUMN reminder_days_before SET DEFAULT '{2}';
-- 3) Per-notification channel switches: { "due_today.check": { "telegram": true, "push": true }, ... }
ALTER TABLE public.notification_settings ADD COLUMN IF NOT EXISTS channels jsonb NOT NULL DEFAULT '{}'::jsonb;
-- 4) Dedup kind for the 23:00 expense reminder.
ALTER TYPE notification_delivery_kind ADD VALUE IF NOT EXISTS 'expense_reminder';
ALTER TYPE notification_delivery_kind ADD VALUE IF NOT EXISTS 'price_update';
