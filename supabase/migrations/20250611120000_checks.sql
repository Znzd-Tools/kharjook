-- Bank checks (چک) tracking with optional settle → expense transaction.

CREATE TYPE check_status AS ENUM ('pending', 'cleared', 'bounced', 'cancelled');

CREATE TABLE IF NOT EXISTS checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL,
  bank_name text,
  check_number text,
  amount numeric NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'IRT' CHECK (currency IN ('IRT', 'USD', 'TRY', 'EUR')),
  due_date_string text NOT NULL,
  wallet_id uuid REFERENCES wallets (id) ON DELETE SET NULL,
  category_id uuid REFERENCES categories (id) ON DELETE SET NULL,
  status check_status NOT NULL DEFAULT 'pending',
  cleared_at timestamptz,
  paid_transaction_id uuid REFERENCES transactions (id) ON DELETE SET NULL,
  note text,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS checks_user_due_pending_idx
  ON checks (user_id, due_date_string)
  WHERE status = 'pending' AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS checks_user_status_idx
  ON checks (user_id, status)
  WHERE deleted_at IS NULL;

ALTER TABLE checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY checks_select_own ON checks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY checks_insert_own ON checks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY checks_update_own ON checks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY checks_delete_own ON checks
  FOR DELETE USING (auth.uid() = user_id);
