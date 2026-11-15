-- Third state for asset categories: "ignored".
--   in_portfolio = true                               -> investment portfolio
--   in_portfolio = false, ignore_in_wealth = false    -> total wealth only
--   in_portfolio = false, ignore_in_wealth = true     -> ignored: the assets
--     kept out of the portfolio count in no total (e.g. a stake with no
--     market price). They still show in the assets list.
-- ignore_in_wealth has no effect while in_portfolio is true.
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS ignore_in_wealth boolean NOT NULL DEFAULT false;
