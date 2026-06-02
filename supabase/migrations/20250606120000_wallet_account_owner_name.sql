ALTER TABLE wallets
  ADD COLUMN IF NOT EXISTS account_owner_name text;
