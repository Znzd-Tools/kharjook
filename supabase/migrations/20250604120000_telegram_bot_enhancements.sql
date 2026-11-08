-- Bot reminder flow state (wallet pick for «پرداخت» on an installment reminder)

ALTER TABLE telegram_connections
  ADD COLUMN IF NOT EXISTS bot_flow jsonb;
