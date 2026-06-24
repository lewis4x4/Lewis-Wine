-- Pourfolio Intelligence Sprint B: sourced buy-again price evidence.

create table if not exists public.price_observations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  wine_id uuid not null references public.wines(id) on delete cascade,
  source_name text not null,
  source_url text not null check (length(trim(source_url)) > 0),
  price numeric(10,2) not null check (price >= 0),
  currency text not null default 'USD',
  availability text not null check (availability in ('in_stock','limited','unknown','oos')) default 'unknown',
  confidence numeric(3,2) not null check (confidence >= 0 and confidence <= 1),
  observed_at timestamptz not null default now(),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.buy_again_queue (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  wine_id uuid not null references public.wines(id) on delete cascade,
  status text not null check (status in ('active','acquired','dismissed')) default 'active',
  target_price numeric(10,2),
  best_observation_id uuid references public.price_observations(id) on delete set null,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, wine_id)
);

create index if not exists idx_price_observations_wine on public.price_observations(owner_id, wine_id, observed_at desc);
create index if not exists idx_price_observations_availability on public.price_observations(owner_id, availability, confidence desc);
create index if not exists idx_buy_again_queue_owner_status on public.buy_again_queue(owner_id, status, updated_at desc);

alter table public.price_observations enable row level security;
alter table public.buy_again_queue enable row level security;

drop policy if exists "Users manage own intelligence price observations" on public.price_observations;
create policy "Users manage own intelligence price observations"
  on public.price_observations
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Users manage own buy again queue" on public.buy_again_queue;
create policy "Users manage own buy again queue"
  on public.buy_again_queue
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
