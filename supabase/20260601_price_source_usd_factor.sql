-- Optional USD step after conversion_rate on fetched quotes.
-- Formula: raw * conversion_rate, then * usd or / usd when usd_factor is set.
-- Run once in Supabase SQL editor (after 20260531_price_source_conversion_rate.sql).

alter table public.price_source_settings
  add column if not exists usd_factor text not null default 'none';

alter table public.price_source_settings
  drop constraint if exists price_source_settings_usd_factor_check;

alter table public.price_source_settings
  add constraint price_source_settings_usd_factor_check
  check (usd_factor in ('none', 'multiply', 'divide'));

comment on column public.price_source_settings.usd_factor is
  'After conversion_rate: none = skip; multiply = × USD/Toman rate; divide = ÷ USD/Toman rate.';
