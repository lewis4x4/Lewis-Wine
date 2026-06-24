-- Pourfolio Intelligence Sprint A: Great Wine Capture + benchmark tastings.

create table if not exists public.wines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  producer text,
  label text not null,
  vintage integer check (vintage is null or vintage between 1800 and 2200),
  region text,
  subregion text,
  country text,
  varietal text,
  wine_type text check (wine_type is null or wine_type in ('red','white','rose','sparkling','dessert','fortified')),
  created_at timestamptz not null default now()
);

create index if not exists idx_wines_owner on public.wines(owner_id);
create index if not exists idx_wines_dedupe on public.wines(owner_id, lower(coalesce(producer, '')), vintage, lower(label));

create table if not exists public.tastings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  wine_id uuid not null references public.wines(id) on delete cascade,
  score integer check (score is null or score between 50 and 100),
  buy_again text check (buy_again is null or buy_again in ('yes','no','maybe','cellar_only')),
  occasion text,
  descriptors text[] not null default '{}',
  notes text,
  is_benchmark boolean generated always as (coalesce(score, 0) >= 94) stored,
  evidence_path text,
  extraction jsonb not null default '{}'::jsonb,
  tasted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_tastings_owner on public.tastings(owner_id, tasted_at desc);
create index if not exists idx_tastings_wine on public.tastings(wine_id);
create index if not exists idx_tastings_benchmark on public.tastings(owner_id, is_benchmark, score desc) where is_benchmark;

insert into storage.buckets (id, name, public)
values ('wine-evidence', 'wine-evidence', false)
on conflict (id) do nothing;

alter table public.wines enable row level security;
alter table public.tastings enable row level security;

drop policy if exists "Users manage own wines" on public.wines;
create policy "Users manage own wines"
  on public.wines
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Users manage own tastings" on public.tastings;
create policy "Users manage own tastings"
  on public.tastings
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "Users manage own wine evidence objects" on storage.objects;
create policy "Users manage own wine evidence objects"
  on storage.objects
  for all
  using (
    bucket_id = 'wine-evidence'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'wine-evidence'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
