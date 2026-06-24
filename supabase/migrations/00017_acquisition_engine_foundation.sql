-- Phase E1/E2: Acquisition Engine foundation.
-- Unified acquisition watchlist and price-refresh queue for Buy Again, wishlist, shopping, and restaurant discoveries.

create table if not exists public.acquisition_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  wine_reference_id uuid references public.wine_reference(id) on delete set null,
  inventory_id uuid references public.cellar_inventory(id) on delete set null,
  source_kind text not null check (source_kind in ('buy_again','wishlist','shopping','restaurant_discovery','manual')) default 'manual',
  source_id uuid,
  status text not null check (status in ('watching','buy_now','ordered','acquired','passed')) default 'watching',
  priority text not null check (priority in ('must_have','high','medium','low')) default 'medium',
  wine_title text not null,
  producer text,
  vintage integer,
  region text,
  varietal text,
  desired_quantity integer not null default 1 check (desired_quantity > 0),
  target_price_cents integer check (target_price_cents is null or target_price_cents >= 0),
  max_price_cents integer check (max_price_cents is null or max_price_cents >= 0),
  last_refreshed_at timestamptz,
  next_refresh_at timestamptz,
  ordered_at timestamptz,
  acquired_at timestamptz,
  passed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.acquisition_price_observations (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.acquisition_watchlist(id) on delete cascade,
  source_type text not null check (source_type in ('manual','cellartracker','wine_market_journal','retailer','winery','auction','public_web','ai_search','ai_inferred','wine_searcher_trial','provider','unknown')) default 'manual',
  source_name text,
  source_url text,
  observed_price_cents integer check (observed_price_cents is null or observed_price_cents >= 0),
  currency text not null default 'USD',
  availability text not null check (availability in ('available','limited','unknown','sold_out')) default 'unknown',
  confidence integer not null default 0 check (confidence between 0 and 100),
  observed_at timestamptz not null default now(),
  notes text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.acquisition_watchlist
  add column if not exists best_price_observation_id uuid references public.acquisition_price_observations(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'acquisition_watchlist_source_unique'
      and conrelid = 'public.acquisition_watchlist'::regclass
  ) then
    alter table public.acquisition_watchlist
      add constraint acquisition_watchlist_source_unique unique nulls not distinct (user_id, source_kind, source_id);
  end if;
end $$;

create index if not exists idx_acquisition_watchlist_user_status on public.acquisition_watchlist(user_id, status, priority);
create index if not exists idx_acquisition_watchlist_refresh on public.acquisition_watchlist(user_id, next_refresh_at) where status in ('watching','buy_now');
create index if not exists idx_acquisition_price_observations_target on public.acquisition_price_observations(target_id, observed_at desc);

alter table public.acquisition_watchlist enable row level security;
alter table public.acquisition_price_observations enable row level security;

drop policy if exists "Users can manage their own acquisition watchlist" on public.acquisition_watchlist;
create policy "Users can manage their own acquisition watchlist"
  on public.acquisition_watchlist
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage acquisition price observations" on public.acquisition_price_observations;
create policy "Users can manage acquisition price observations"
  on public.acquisition_price_observations
  for all
  using (
    exists (
      select 1 from public.acquisition_watchlist aw
      where aw.id = acquisition_price_observations.target_id and aw.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.acquisition_watchlist aw
      where aw.id = acquisition_price_observations.target_id and aw.user_id = auth.uid()
    )
  );

create or replace function public.update_acquisition_watchlist_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_acquisition_watchlist_updated_at on public.acquisition_watchlist;
create trigger update_acquisition_watchlist_updated_at
  before update on public.acquisition_watchlist
  for each row execute function public.update_acquisition_watchlist_updated_at();
