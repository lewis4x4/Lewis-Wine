-- Consumption ledger: marking a bottle consumed used to hard-set quantity to
-- 0, destroying multi-bottle history with no record. Consumption now
-- decrements quantity and every consume/restore writes an event row so
-- history is derivable and restore no longer guesses.

create table if not exists public.cellar_consumption_events (
  id uuid primary key default gen_random_uuid(),
  inventory_id uuid not null references public.cellar_inventory(id) on delete cascade,
  event_type text not null check (event_type in ('consumed', 'restored')),
  quantity integer not null check (quantity > 0),
  quantity_after integer not null check (quantity_after >= 0),
  occurred_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_cellar_consumption_events_inventory
  on public.cellar_consumption_events(inventory_id, occurred_at desc);

alter table public.cellar_consumption_events enable row level security;

drop policy if exists "Users can manage consumption events for owned bottles" on public.cellar_consumption_events;
create policy "Users can manage consumption events for owned bottles"
  on public.cellar_consumption_events
  for all
  using (
    exists (
      select 1 from public.cellar_inventory ci
      join public.cellars c on c.id = ci.cellar_id
      where ci.id = cellar_consumption_events.inventory_id and c.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.cellar_inventory ci
      join public.cellars c on c.id = ci.cellar_id
      where ci.id = cellar_consumption_events.inventory_id and c.owner_id = auth.uid()
    )
  );
