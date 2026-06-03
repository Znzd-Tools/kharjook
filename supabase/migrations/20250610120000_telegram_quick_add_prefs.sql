-- Bot quick-add UX: remember last wallet/category and allow short undo window.

ALTER TABLE telegram_connections
  ADD COLUMN IF NOT EXISTS quick_add_prefs jsonb NOT NULL DEFAULT '{}';

ALTER TABLE telegram_connections
  ADD COLUMN IF NOT EXISTS undo_last jsonb;
