-- Asset categories belong to one of two buckets:
--   in_portfolio = true  -> investment portfolio (goals, allocation, net worth)
--   in_portfolio = false -> total wealth only (car, deposit, private equity ...)
-- The flag is the default for the assets of the category: the app copies it
-- to assets.include_in_balance when the category is saved or an asset is
-- put in it. Income/expense categories ignore it.
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS in_portfolio boolean NOT NULL DEFAULT true;

-- Backfill: an asset category whose assets are ALL excluded from the balance
-- today is already used as "total wealth only".
UPDATE public.categories c
SET in_portfolio = false
WHERE c.kind = 'asset'
  AND EXISTS (SELECT 1 FROM public.assets a WHERE a.category_id = c.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.assets a
    WHERE a.category_id = c.id AND a.include_in_balance IS DISTINCT FROM false
  );
