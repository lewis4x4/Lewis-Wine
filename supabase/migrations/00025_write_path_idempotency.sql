-- Write-path idempotency hardening from the 2026-07-01 deep-dive review:
-- 1. Field-capture add_to_cellar retries could duplicate cellar_inventory
--    rows (idempotency only covered tastings/ratings).
-- 2. Acquisition receipt double-submits duplicated bottles and price
--    evidence wholesale (no key, no dedupe).
-- 3. idx_wines_dedupe was a plain index; concurrent captures could split one
--    wine identity across two rows.

-- 1. Cover the cellar_inventory insert with the same replay-safe key the
--    tasting/rating inserts already use.
alter table public.cellar_inventory
  add column if not exists field_capture_idempotency_key text;

create unique index if not exists idx_cellar_inventory_field_capture_idem
  on public.cellar_inventory(field_capture_idempotency_key)
  where field_capture_idempotency_key is not null;

-- 2. Client-supplied idempotency key on receipts, unique per user, so a
--    retry after a mid-loop failure replays instead of re-inserting.
alter table public.acquisition_receipts
  add column if not exists idempotency_key text;

create unique index if not exists idx_acquisition_receipts_idem
  on public.acquisition_receipts(user_id, idempotency_key)
  where idempotency_key is not null;

-- 3. Enforce one wine identity per owner at the database level. The
--    expression collapses internal whitespace to match the app-side
--    buildWineIdentityKey normalization; coalesce keeps nullable columns
--    inside normal unique semantics.
-- NOTE: if this index creation fails, duplicate wine identities already
-- exist. Find them with:
--   select owner_id, lower(regexp_replace(coalesce(producer,''),'\s+',' ','g')) p,
--          coalesce(vintage,-1) v, lower(regexp_replace(label,'\s+',' ','g')) l, count(*)
--   from public.wines group by 1,2,3,4 having count(*) > 1;
-- and merge them (repoint tastings/buy_again_queue/price_observations) first.
drop index if exists idx_wines_dedupe;

create unique index if not exists idx_wines_identity_unique
  on public.wines(
    owner_id,
    lower(regexp_replace(coalesce(producer, ''), '\s+', ' ', 'g')),
    coalesce(vintage, -1),
    lower(regexp_replace(label, '\s+', ' ', 'g'))
  );
