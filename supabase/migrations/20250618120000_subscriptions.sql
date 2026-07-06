-- Recurring subscriptions with manual settle → expense transaction.

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  platform text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'IRT' CHECK (currency IN ('IRT', 'USD', 'TRY', 'EUR')),
  interval_number integer NOT NULL DEFAULT 1 CHECK (interval_number > 0),
  interval_period text NOT NULL DEFAULT 'month'
    CHECK (interval_period IN ('day', 'week', 'month', 'year')),
  next_due_date_string text NOT NULL,
  wallet_id uuid REFERENCES wallets (id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  cancelled_at timestamptz,
  reminder_days_before integer[] NOT NULL DEFAULT '{}',
  note text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES subscriptions (id) ON DELETE CASCADE,
  due_date_string text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL,
  transaction_id uuid NOT NULL REFERENCES transactions (id) ON DELETE CASCADE,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, due_date_string)
);

CREATE INDEX IF NOT EXISTS subscriptions_user_due_active_idx
  ON subscriptions (user_id, next_due_date_string)
  WHERE status = 'active' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS subscriptions_user_status_idx
  ON subscriptions (user_id, status)
  WHERE deleted_at IS NULL;

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_select_own ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY subscriptions_insert_own ON subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY subscriptions_update_own ON subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY subscriptions_delete_own ON subscriptions
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY subscription_payments_select_own ON subscription_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY subscription_payments_insert_own ON subscription_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
