-- Source-backed drink-window evidence observations.
-- Local migration only until production Supabase approval is explicit.

create table if not exists public.wine_drink_window_observations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  inventory_id uuid references public.cellar_inventory(id) on delete cascade,
  wine_reference_id uuid references public.wine_reference(id) on delete set null,
  evidence_id uuid references public.wine_intelligence_evidence(id) on delete set null,
  source_type text not null check (source_type in ('manual','cellartracker','wine_market_journal','retailer','winery','auction','public_web','ai_search','ai_inferred','wine_searcher_trial','provider','unknown')),
  source_name text not null,
  source_url text,
  truth_label text not null check (truth_label in ('verified','estimated','ai_inferred','unknown','stale','rejected')) default 'unknown',
  review_status text not null check (review_status in ('draft','accepted','rejected','superseded')) default 'draft',
  drink_after date,
  drink_before date,
  peak_start date,
  peak_end date,
  serving_guidance text,
  confidence integer not null default 0 check (confidence between 0 and 100),
  observed_at timestamptz not null default now(),
  reviewed_at timestamptz,
  notes text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint wine_drink_window_observations_subject_check check (inventory_id is not null or wine_reference_id is not null),
  constraint wine_drink_window_observations_window_order_check check (drink_after is null or drink_before is null or drink_after <= drink_before),
  constraint wine_drink_window_observations_peak_order_check check (peak_start is null or peak_end is null or peak_start <= peak_end),
  constraint wine_drink_window_observations_peak_start_inside_check check (
    peak_start is null or
    ((drink_after is null or peak_start >= drink_after) and (drink_before is null or peak_start <= drink_before))
  ),
  constraint wine_drink_window_observations_peak_end_inside_check check (
    peak_end is null or
    ((drink_after is null or peak_end >= drink_after) and (drink_before is null or peak_end <= drink_before))
  )
);

create index if not exists idx_wine_drink_window_observations_owner_review
  on public.wine_drink_window_observations(owner_id, review_status, observed_at desc);
create index if not exists idx_wine_drink_window_observations_inventory
  on public.wine_drink_window_observations(inventory_id, observed_at desc);
create index if not exists idx_wine_drink_window_observations_reference
  on public.wine_drink_window_observations(wine_reference_id, observed_at desc);
create unique index if not exists idx_wine_drink_window_observations_evidence_unique
  on public.wine_drink_window_observations(evidence_id)
  where evidence_id is not null;

alter table public.wine_drink_window_observations enable row level security;

drop policy if exists "Users can manage drink-window observations" on public.wine_drink_window_observations;
create policy "Users can manage drink-window observations"
  on public.wine_drink_window_observations
  for all
  using (
    owner_id = auth.uid()
    and (
      inventory_id is null
      or exists (
        select 1 from public.cellar_inventory ci
        join public.cellars c on c.id = ci.cellar_id
        where ci.id = wine_drink_window_observations.inventory_id
          and c.owner_id = auth.uid()
      )
    )
  )
  with check (
    owner_id = auth.uid()
    and (
      inventory_id is null
      or exists (
        select 1 from public.cellar_inventory ci
        join public.cellars c on c.id = ci.cellar_id
        where ci.id = wine_drink_window_observations.inventory_id
          and c.owner_id = auth.uid()
      )
    )
  );

drop trigger if exists set_wine_drink_window_observations_updated_at on public.wine_drink_window_observations;
create trigger set_wine_drink_window_observations_updated_at
  before update on public.wine_drink_window_observations
  for each row execute function update_updated_at();
