-- Phase E4: Acquisition Receipt Capture.
-- Records purchase receipts, line items, and acquisition closeout evidence.

create table if not exists public.acquisition_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  vendor text,
  vendor_type text not null check (vendor_type in ('retailer','winery','auction','private','other')) default 'retailer',
  purchase_date date not null default current_date,
  subtotal_cents integer check (subtotal_cents is null or subtotal_cents >= 0),
  tax_cents integer check (tax_cents is null or tax_cents >= 0),
  total_cents integer check (total_cents is null or total_cents >= 0),
  receipt_text text,
  receipt_image_path text,
  notes text,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.acquisition_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.acquisition_receipts(id) on delete cascade,
  acquisition_target_id uuid references public.acquisition_watchlist(id) on delete set null,
  inventory_id uuid references public.cellar_inventory(id) on delete set null,
  price_observation_id uuid references public.wine_price_observations(id) on delete set null,
  selected boolean not null default true,
  action text not null check (action in ('close_acquisition_and_add_to_cellar','add_to_cellar','record_only')) default 'add_to_cellar',
  wine_title text not null,
  producer text,
  label text,
  vintage integer,
  region text,
  varietal text,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_cents integer check (unit_price_cents is null or unit_price_cents >= 0),
  line_total_cents integer check (line_total_cents is null or line_total_cents >= 0),
  raw_text text,
  created_at timestamptz not null default now()
);

alter table public.acquisition_watchlist
  add column if not exists acquired_quantity integer,
  add column if not exists acquired_price_cents integer,
  add column if not exists acquisition_receipt_id uuid references public.acquisition_receipts(id) on delete set null;

create index if not exists idx_acquisition_receipts_user_date on public.acquisition_receipts(user_id, purchase_date desc, created_at desc);
create index if not exists idx_acquisition_receipt_items_receipt on public.acquisition_receipt_items(receipt_id);
create index if not exists idx_acquisition_receipt_items_target on public.acquisition_receipt_items(acquisition_target_id) where acquisition_target_id is not null;

alter table public.acquisition_receipts enable row level security;
alter table public.acquisition_receipt_items enable row level security;

drop policy if exists "Users can manage their own acquisition receipts" on public.acquisition_receipts;
create policy "Users can manage their own acquisition receipts"
  on public.acquisition_receipts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can manage acquisition receipt items" on public.acquisition_receipt_items;
create policy "Users can manage acquisition receipt items"
  on public.acquisition_receipt_items
  for all
  using (
    exists (
      select 1 from public.acquisition_receipts ar
      where ar.id = acquisition_receipt_items.receipt_id and ar.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.acquisition_receipts ar
      where ar.id = acquisition_receipt_items.receipt_id and ar.user_id = auth.uid()
    )
  );

create or replace function public.update_acquisition_receipts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_acquisition_receipts_updated_at on public.acquisition_receipts;
create trigger update_acquisition_receipts_updated_at
  before update on public.acquisition_receipts
  for each row execute function public.update_acquisition_receipts_updated_at();
