-- Each person has one currency. Balances with that person are kept in it
-- (for example a USD loan to a friend is returned in USD). Existing persons: IRT.
ALTER TABLE public.persons
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'IRT';

ALTER TABLE public.persons DROP CONSTRAINT IF EXISTS persons_currency_check;
ALTER TABLE public.persons
  ADD CONSTRAINT persons_currency_check CHECK (currency IN ('IRT', 'USD', 'TRY', 'EUR'));
