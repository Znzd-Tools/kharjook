-- Opening balance with a person, in the person's currency.
-- > 0: the person owes the user. < 0: the user owes the person.
-- It records an old debt without a money movement. Existing persons: 0.
ALTER TABLE public.persons
  ADD COLUMN IF NOT EXISTS initial_balance numeric NOT NULL DEFAULT 0;
