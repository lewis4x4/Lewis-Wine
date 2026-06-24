-- Pourfolio Intelligence Sprint C: taste profile history + wine-list advisor.

create table if not exists public.taste_profile (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  loved_descriptors text[] not null default '{}',
  preferred_regions text[] not null default '{}',
  preferred_varietals text[] not null default '{}',
  preferred_producers text[] not null default '{}',
  price_band jsonb not null default '{"low":null,"typical":null,"high":null}'::jsonb,
  avoid_list text[] not null default '{}',
  benchmark_wine_ids uuid[] not null default '{}',
  refreshed_at timestamptz not null default now()
);

create table if not exists public.wine_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  evidence_path text,
  restaurant text,
  cuisine text,
  context text,
  parsed jsonb not null default '[]'::jsonb,
  recommendations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_taste_profile_owner_refreshed on public.taste_profile(owner_id, refreshed_at desc);
create index if not exists idx_wine_lists_owner_created on public.wine_lists(owner_id, created_at desc);

alter table public.taste_profile enable row level security;
alter table public.wine_lists enable row level security;

drop policy if exists "Users manage own taste profile history" on public.taste_profile;
create policy "Users manage own taste profile history"
  on public.taste_profile
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Users manage own wine lists" on public.wine_lists;
create policy "Users manage own wine lists"
  on public.wine_lists
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
