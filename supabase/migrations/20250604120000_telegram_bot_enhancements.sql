-- Bot navigation, guided flows, price-alert toggle

ALTER TABLE telegram_connections
  ADD COLUMN IF NOT EXISTS menu_stack text[] NOT NULL DEFAULT ARRAY['main']::text[],
  ADD COLUMN IF NOT EXISTS bot_flow jsonb;

ALTER TABLE notification_settings
  ADD COLUMN IF NOT EXISTS price_alert_enabled boolean NOT NULL DEFAULT false;
