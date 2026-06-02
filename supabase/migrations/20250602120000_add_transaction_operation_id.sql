ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS operation_id uuid NULL;

CREATE INDEX IF NOT EXISTS transactions_operation_id_idx ON transactions (operation_id);
