-- Net worth history: one row per user per Tehran day (daily job) and one per
-- past month-end (backfill from transactions + stored prices).
CREATE TABLE IF NOT EXISTS public.portfolio_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  date_string text NOT NULL CHECK (date_string ~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}$'),
  total_toman numeric NOT NULL,
  total_usd numeric NOT NULL,
  assets_toman numeric NOT NULL,
  cash_toman numeric NOT NULL,
  usd_rate numeric,
  missing_price_count integer NOT NULL DEFAULT 0,
  -- { "<asset_id>": { "qty": n, "toman": n, "usd": n } }
  by_asset jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- { "<asset category id or __none__>": toman }
  by_group jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'daily' CHECK (source IN ('daily', 'backfill')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date_string)
);

CREATE INDEX IF NOT EXISTS portfolio_snapshots_user_date_idx ON public.portfolio_snapshots (user_id, date_string);

ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS portfolio_snapshots_select_own ON public.portfolio_snapshots;
CREATE POLICY portfolio_snapshots_select_own ON public.portfolio_snapshots FOR SELECT USING (auth.uid() = user_id);
-- Writes only by the server (service role).
