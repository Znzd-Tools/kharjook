-- UX v2 (S24): let the user review transactions created by recurring
-- rules. Additive: auto-creation is unchanged; we only remember whether
-- the user has seen / confirmed each run.

ALTER TABLE recurring_transaction_runs
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- Existing runs are history: do not ask the user to review them.
UPDATE recurring_transaction_runs SET reviewed_at = created_at WHERE reviewed_at IS NULL;

CREATE POLICY recurring_transaction_runs_update_own ON recurring_transaction_runs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM recurring_transactions r
      WHERE r.id = recurring_id AND r.user_id = auth.uid()
    )
  );
