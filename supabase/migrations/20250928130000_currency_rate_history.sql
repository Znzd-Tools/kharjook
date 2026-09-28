-- Historical Toman rates per user, currency and Jalali day.
--
-- The Toman/USD rate moves a lot, so a past-dated row must be converted at
-- the rate of ITS date. `currency_rates` only holds the current rate; this
-- table keeps one row per day we know a rate for. Days without a row are
-- estimated in code by straight-line interpolation between neighbours.
--
-- source priority (a higher one may overwrite a lower one, never the reverse
-- — enforced in code): manual > provider > derived
--   manual   = user saved the rate
--   provider = daily auto price refresh
--   derived  = rebuilt by the app from snapshots / transactions

CREATE TABLE IF NOT EXISTS currency_rate_history (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  currency text NOT NULL CHECK (currency IN ('USD', 'TRY', 'EUR')),
  date_string text NOT NULL CHECK (date_string ~ '^[0-9]{4}/[0-9]{2}/[0-9]{2}$'),
  toman_per_unit numeric NOT NULL CHECK (toman_per_unit > 0),
  source text NOT NULL CHECK (source IN ('manual', 'provider', 'derived')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, currency, date_string)
);

ALTER TABLE currency_rate_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY currency_rate_history_select_own ON currency_rate_history
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY currency_rate_history_insert_own ON currency_rate_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY currency_rate_history_update_own ON currency_rate_history
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY currency_rate_history_delete_own ON currency_rate_history
  FOR DELETE USING (auth.uid() = user_id);
