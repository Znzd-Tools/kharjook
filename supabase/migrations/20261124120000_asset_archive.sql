-- Archive for assets (wallets already have archived_at).
-- An archived asset is hidden from lists and pickers and is not counted in
-- any total. Its transactions stay; restore brings it back as it was.
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS archived_at timestamptz;
