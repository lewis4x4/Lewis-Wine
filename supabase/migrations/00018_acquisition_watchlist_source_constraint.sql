-- Phase E1/E2 correction: allow multiple manual acquisition targets without source IDs.

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'acquisition_watchlist_source_unique'
      and conrelid = 'public.acquisition_watchlist'::regclass
  ) then
    alter table public.acquisition_watchlist drop constraint acquisition_watchlist_source_unique;
  end if;
end $$;

create unique index if not exists idx_acquisition_watchlist_source_unique
  on public.acquisition_watchlist(user_id, source_kind, source_id)
  where source_id is not null;
