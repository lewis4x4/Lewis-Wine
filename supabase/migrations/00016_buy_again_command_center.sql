-- Pourfolio Intelligence Phase D3: Buy Again Command Center workflow states.

alter table public.buy_again_queue
  drop constraint if exists buy_again_queue_status_check;

alter table public.buy_again_queue
  add constraint buy_again_queue_status_check
  check (status in ('active','watch','acquired','dismissed'));

alter table public.buy_again_queue
  add column if not exists acquired_at timestamptz,
  add column if not exists dismissed_at timestamptz,
  add column if not exists snoozed_until timestamptz,
  add column if not exists note text;

create index if not exists idx_buy_again_queue_owner_snoozed
  on public.buy_again_queue(owner_id, snoozed_until)
  where snoozed_until is not null;
