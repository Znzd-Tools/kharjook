-- Where each asset is held (exchange, wallet, bank, cash ...).
-- Places are the user's own list. Holdings are a virtual split of an asset's
-- quantity over places: no transaction is made, and a buy never asks for a
-- place. Quantity not in any place shows as "unplaced" on the dashboard.
CREATE TABLE IF NOT EXISTS public.asset_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  kind text NOT NULL DEFAULT 'other' CHECK (kind IN ('exchange', 'wallet', 'bank', 'cash', 'other')),
  note text,
  order_index integer,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS asset_places_user_idx ON public.asset_places (user_id);

CREATE TABLE IF NOT EXISTS public.asset_place_holdings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets (id) ON DELETE CASCADE,
  place_id uuid NOT NULL REFERENCES public.asset_places (id) ON DELETE CASCADE,
  quantity numeric NOT NULL CHECK (quantity >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asset_id, place_id)
);
CREATE INDEX IF NOT EXISTS asset_place_holdings_user_idx ON public.asset_place_holdings (user_id);

ALTER TABLE public.asset_places ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_place_holdings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS asset_places_all_own ON public.asset_places;
CREATE POLICY asset_places_all_own ON public.asset_places
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS asset_place_holdings_all_own ON public.asset_place_holdings;
CREATE POLICY asset_place_holdings_all_own ON public.asset_place_holdings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
