-- Per-user multiplier applied to fetched provider quotes before persisting.
-- Example: abantether.ast_gold with conversion_rate = 1000 stores quote * 1000.
-- Run once in Supabase SQL editor.

create table if not exists public.price_source_settings (
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  conversion_rate numeric not null default 1 check (conversion_rate > 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, slug)
);

create index if not exists price_source_settings_user_idx
  on public.price_source_settings(user_id);

alter table public.price_source_settings enable row level security;

drop policy if exists "price_source_settings_select_own" on public.price_source_settings;
create policy "price_source_settings_select_own" on public.price_source_settings
for select using (auth.uid() = user_id);

drop policy if exists "price_source_settings_insert_own" on public.price_source_settings;
create policy "price_source_settings_insert_own" on public.price_source_settings
for insert with check (auth.uid() = user_id);

drop policy if exists "price_source_settings_update_own" on public.price_source_settings;
create policy "price_source_settings_update_own" on public.price_source_settings
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "price_source_settings_delete_own" on public.price_source_settings;
create policy "price_source_settings_delete_own" on public.price_source_settings
for delete using (auth.uid() = user_id);

comment on table public.price_source_settings is
  'User-specific multiplier for external price sources; fetched quote is multiplied by conversion_rate before save.';

comment on column public.price_source_settings.conversion_rate is
  'Positive multiplier applied to the raw provider quote (default 1 = no change).';

-- Seed every catalog slug at 1 for all existing users.
-- Keep slug list in sync with src/features/prices/constants/price-sources.ts
insert into public.price_source_settings (user_id, slug, conversion_rate)
select u.id, s.slug, 1
from auth.users u
cross join (
  values
    ('app.dollar'),
    ('abantether.usdt'),
    ('abantether.btc'),
    ('abantether.sol'),
    ('abantether.eth'),
    ('abantether.paxg'),
    ('abantether.ast_brsbox'),
    ('abantether.ast_gold'),
    ('abantether.copxon'),
    ('abantether.slvon'),
    ('zarpay.gold'),
    ('zarpay.silver'),
    ('zarpay.copper')
) as s(slug)
on conflict (user_id, slug) do nothing;
