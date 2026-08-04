-- Relax auto-income pairing so asset loans can set auto_income_on_create
-- without auto_income_wallet_id (credit goes to asset_id instead).

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'loans'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%auto_income%'
  LOOP
    EXECUTE format('ALTER TABLE public.loans DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.loans
  DROP CONSTRAINT IF EXISTS loans_auto_income_pairing;

ALTER TABLE public.loans
  ADD CONSTRAINT loans_auto_income_pairing CHECK (
    (
      type = 'expense'
      AND category_id IS NOT NULL
      AND auto_income_on_create = false
      AND auto_income_wallet_id IS NULL
    )
    OR (
      type = 'loan'
      AND category_id IS NULL
      AND (
        (auto_income_on_create = false AND auto_income_wallet_id IS NULL)
        OR (auto_income_on_create = true AND auto_income_wallet_id IS NOT NULL)
        OR (
          auto_income_on_create = true
          AND asset_id IS NOT NULL
          AND auto_income_wallet_id IS NULL
        )
      )
    )
  );
