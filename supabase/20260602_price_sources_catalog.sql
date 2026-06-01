-- User-scoped price source catalog. Provider fetch logic (abantether/zarpay) stays in app code;
-- this table stores slug, label, fetch_key, and metadata per user.
-- Run once in Supabase SQL editor.

create table if not exists public.price_sources (
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  provider text not null check (provider in ('abantether', 'zarpay')),
  label text not null,
  fetch_key text,
  updates_rate text check (updates_rate is null or updates_rate in ('USD', 'TRY', 'EUR')),
  deprecated boolean not null default false,
  is_builtin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, slug),
  constraint price_sources_slug_format check (slug ~ '^[a-z0-9][a-z0-9._-]*$')
);

create index if not exists price_sources_user_idx
  on public.price_sources(user_id);

alter table public.price_sources enable row level security;

drop policy if exists "price_sources_select_own" on public.price_sources;
create policy "price_sources_select_own" on public.price_sources
for select using (auth.uid() = user_id);

drop policy if exists "price_sources_insert_own" on public.price_sources;
create policy "price_sources_insert_own" on public.price_sources
for insert with check (auth.uid() = user_id);

drop policy if exists "price_sources_update_own" on public.price_sources;
create policy "price_sources_update_own" on public.price_sources
for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "price_sources_delete_own" on public.price_sources;
create policy "price_sources_delete_own" on public.price_sources
for delete using (auth.uid() = user_id);

comment on table public.price_sources is
  'Per-user catalog of external price sources. Providers are fixed in app code; slugs/keys/labels are user-managed.';

-- Seed built-in catalog for all existing users.
-- Keep in sync with DEFAULT_PRICE_SOURCES in src/features/prices/constants/price-sources.ts
insert into public.price_sources (user_id, slug, provider, label, fetch_key, updates_rate, is_builtin)
select u.id, s.slug, s.provider, s.label, s.fetch_key, s.updates_rate, true
from auth.users u
cross join (
  values
    ('app.dollar',           'abantether', 'دلار',              'USDT',       'USD'),
    ('abantether.usdt',      'abantether', 'تتر · آبان‌تتر',    'USDT',       null),
    ('abantether.btc',       'abantether', 'بیت‌کوین · آبان‌تتر','BTC',        null),
    ('abantether.sol',       'abantether', 'سولانا · آبان‌تتر', 'SOL',        null),
    ('abantether.eth',       'abantether', 'اتریوم · آبان‌تتر', 'ETH',        null),
    ('abantether.paxg',      'abantether', 'پکس گلد · آبان‌تتر','PAXG',       null),
    ('abantether.ast_brsbox','abantether', 'بورس باکس · آبان‌تتر','AST_BRSBOX', null),
    ('abantether.ast_gold',  'abantether', 'طلا ۱۸ عیار · آبان‌تتر',    'AST_GOLD',   null),
    ('abantether.copxon',    'abantether', 'مس · آبان‌تتر',     'COPXON',     null),
    ('abantether.slvon',     'abantether', 'نقره · آبان‌تتر',   'SLVON',      null),
    ('zarpay.gold',          'zarpay',     'طلا ۱۸ عیار · زرپی','GOLD',       null),
    ('zarpay.silver',        'zarpay',     'نقره · زرپی',       'SILVER',     null),
    ('zarpay.copper',        'zarpay',     'مس · زرپی',         'COPPER',     null)
) as s(slug, provider, label, fetch_key, updates_rate)
on conflict (user_id, slug) do nothing;

-- Ensure coefficient rows exist for any newly seeded slugs.
insert into public.price_source_settings (user_id, slug, conversion_rate, usd_factor)
select ps.user_id, ps.slug, 1, 'none'
from public.price_sources ps
on conflict (user_id, slug) do nothing;
