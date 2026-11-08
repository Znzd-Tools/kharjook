-- Budget envelopes (inside the Plan tab). Additive.
-- An envelope = an expense category with money for each month.
--   * Default monthly amount = the category cap (category_spending_caps).
--   * budget_allocations overrides one month (and records moves between envelopes).
--   * rollover: what is left (or overspent) carries to the next month.

CREATE TABLE IF NOT EXISTS public.budget_envelopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories (id) ON DELETE CASCADE,
  rollover boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id)
);

CREATE TABLE IF NOT EXISTS public.budget_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories (id) ON DELETE CASCADE,
  month text NOT NULL CHECK (month ~ '^[0-9]{4}/[0-9]{2}$'),
  -- Can be below 0: money moved out of an envelope that had a carry-over.
  amount_toman numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, category_id, month)
);

CREATE INDEX IF NOT EXISTS budget_allocations_user_month_idx ON public.budget_allocations (user_id, month);

ALTER TABLE public.budget_envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS budget_envelopes_own ON public.budget_envelopes;
CREATE POLICY budget_envelopes_own ON public.budget_envelopes
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS budget_allocations_own ON public.budget_allocations;
CREATE POLICY budget_allocations_own ON public.budget_allocations
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
