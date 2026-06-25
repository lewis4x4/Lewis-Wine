-- Phase E5: Replenishment & Buy-Again Automation.
-- Adds replenishment provenance to Acquisition Engine and records prompt conversions.

alter table public.acquisition_watchlist
  drop constraint if exists acquisition_watchlist_source_kind_check;

alter table public.acquisition_watchlist
  add constraint acquisition_watchlist_source_kind_check
  check (source_kind in ('buy_again','wishlist','shopping','restaurant_discovery','replenishment','manual'));

create table if not exists public.replenishment_prompt_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  inventory_id uuid references public.cellar_inventory(id) on delete set null,
  wine_reference_id uuid references public.wine_reference(id) on delete set null,
  prompt_key text not null,
  action text not null check (action in ('created_acquisition_target','dismissed','snoozed')),
  acquisition_target_id uuid references public.acquisition_watchlist(id) on delete set null,
  snoozed_until timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_replenishment_prompt_events_user_created
  on public.replenishment_prompt_events(user_id, created_at desc);

create index if not exists idx_replenishment_prompt_events_inventory
  on public.replenishment_prompt_events(user_id, inventory_id, created_at desc)
  where inventory_id is not null;

alter table public.replenishment_prompt_events enable row level security;

drop policy if exists "Users can manage their own replenishment prompt events" on public.replenishment_prompt_events;
create policy "Users can manage their own replenishment prompt events"
  on public.replenishment_prompt_events
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
