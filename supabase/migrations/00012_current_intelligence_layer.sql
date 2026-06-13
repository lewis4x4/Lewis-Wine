-- Current Intelligence Layer: evidence receipts, price observations, and refresh audit.

create table if not exists public.wine_intelligence_evidence (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.cellar_inventory(id) on delete cascade,
  wine_reference_id uuid references public.wine_reference(id) on delete set null,
  source_type text not null check (source_type in ('manual','cellartracker','wine_market_journal','retailer','winery','auction','public_web','ai_search','ai_inferred','wine_searcher_trial','provider','unknown')),
  truth_label text not null check (truth_label in ('verified','estimated','ai_inferred','unknown','stale','rejected')) default 'unknown',
  observation_kind text not null check (observation_kind in ('purchase_price','market_value','replacement_price','auction_comp','producer_fact','drink_window','serving_guidance','identity','estimate')) default 'identity',
  review_status text not null check (review_status in ('draft','accepted','rejected','superseded')) default 'draft',
  title text not null,
  source_name text,
  source_url text,
  extracted_facts jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  confidence integer not null default 0 check (confidence between 0 and 100),
  observed_at timestamptz not null default now(),
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wine_price_observations (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.cellar_inventory(id) on delete cascade,
  wine_reference_id uuid references public.wine_reference(id) on delete set null,
  evidence_id uuid references public.wine_intelligence_evidence(id) on delete set null,
  source_type text not null check (source_type in ('manual','cellartracker','wine_market_journal','retailer','winery','auction','public_web','ai_search','ai_inferred','wine_searcher_trial','provider','unknown')),
  source_name text,
  source_url text,
  observation_kind text not null check (observation_kind in ('purchase_price','market_value','replacement_price','auction_comp','estimate')),
  truth_label text not null check (truth_label in ('verified','estimated','ai_inferred','unknown','stale','rejected')) default 'unknown',
  review_status text not null check (review_status in ('draft','accepted','rejected','superseded')) default 'draft',
  observed_price_cents integer check (observed_price_cents is null or observed_price_cents >= 0),
  currency text not null default 'USD',
  bottle_size_ml integer,
  vintage integer,
  confidence integer not null default 0 check (confidence between 0 and 100),
  observed_at timestamptz not null default now(),
  reviewed_at timestamptz,
  notes text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wine_intelligence_refreshes (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.cellar_inventory(id) on delete cascade,
  scope text not null check (scope in ('quick','pricing','readiness','deep','replacement')) default 'quick',
  status text not null check (status in ('planned','completed','failed','skipped')) default 'planned',
  plan jsonb not null default '{}'::jsonb,
  provider_status jsonb not null default '{}'::jsonb,
  gaps jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists idx_wine_intelligence_evidence_inventory on public.wine_intelligence_evidence(inventory_id);
create index if not exists idx_wine_intelligence_evidence_reference on public.wine_intelligence_evidence(wine_reference_id);
create index if not exists idx_wine_intelligence_evidence_review on public.wine_intelligence_evidence(review_status, observed_at desc);
create index if not exists idx_wine_price_observations_inventory on public.wine_price_observations(inventory_id);
create index if not exists idx_wine_price_observations_reference on public.wine_price_observations(wine_reference_id);
create index if not exists idx_wine_price_observations_kind on public.wine_price_observations(observation_kind, review_status, observed_at desc);
create index if not exists idx_wine_intelligence_refreshes_inventory on public.wine_intelligence_refreshes(inventory_id, started_at desc);

alter table public.wine_intelligence_evidence enable row level security;
alter table public.wine_price_observations enable row level security;
alter table public.wine_intelligence_refreshes enable row level security;

drop policy if exists "Users can manage evidence for owned bottles" on public.wine_intelligence_evidence;
create policy "Users can manage evidence for owned bottles"
  on public.wine_intelligence_evidence
  for all
  using (
    exists (
      select 1 from public.cellar_inventory ci
      join public.cellars c on c.id = ci.cellar_id
      where ci.id = wine_intelligence_evidence.inventory_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.cellar_inventory ci
      join public.cellars c on c.id = ci.cellar_id
      where ci.id = wine_intelligence_evidence.inventory_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can manage price observations for owned bottles" on public.wine_price_observations;
create policy "Users can manage price observations for owned bottles"
  on public.wine_price_observations
  for all
  using (
    exists (
      select 1 from public.cellar_inventory ci
      join public.cellars c on c.id = ci.cellar_id
      where ci.id = wine_price_observations.inventory_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.cellar_inventory ci
      join public.cellars c on c.id = ci.cellar_id
      where ci.id = wine_price_observations.inventory_id and c.owner_id = auth.uid()
    )
  );

drop policy if exists "Users can manage refreshes for owned bottles" on public.wine_intelligence_refreshes;
create policy "Users can manage refreshes for owned bottles"
  on public.wine_intelligence_refreshes
  for all
  using (
    exists (
      select 1 from public.cellar_inventory ci
      join public.cellars c on c.id = ci.cellar_id
      where ci.id = wine_intelligence_refreshes.inventory_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.cellar_inventory ci
      join public.cellars c on c.id = ci.cellar_id
      where ci.id = wine_intelligence_refreshes.inventory_id and c.owner_id = auth.uid()
    )
  );
