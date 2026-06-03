-- Virtual savings pots (envelopes) within a wallet — allocation tracking only.

CREATE TABLE IF NOT EXISTS wallet_savings_pots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES wallets (id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#8b5cf6',
  target_amount numeric CHECK (target_amount IS NULL OR target_amount > 0),
  current_amount numeric NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  archived_at timestamptz,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_savings_pots_wallet_active_idx
  ON wallet_savings_pots (wallet_id, order_index)
  WHERE archived_at IS NULL;

ALTER TABLE wallet_savings_pots ENABLE ROW LEVEL SECURITY;

CREATE POLICY wallet_savings_pots_select_own ON wallet_savings_pots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY wallet_savings_pots_insert_own ON wallet_savings_pots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY wallet_savings_pots_update_own ON wallet_savings_pots
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY wallet_savings_pots_delete_own ON wallet_savings_pots
  FOR DELETE USING (auth.uid() = user_id);
