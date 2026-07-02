-- Durable, per-user API rate limiting. The in-memory limiter resets on every
-- serverless cold start and is not shared across instances, so the caps on
-- paid Anthropic endpoints were best-effort only. This table + atomic RPC
-- make them hold. Clients never touch the table directly; only the
-- security-definer RPC does.

create table if not exists public.api_usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  route text not null,
  window_start timestamptz not null,
  request_count integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, route, window_start)
);

alter table public.api_usage_counters enable row level security;
-- Intentionally no policies: all access goes through consume_api_quota.

create or replace function public.consume_api_quota(
  p_route text,
  p_window_seconds integer,
  p_max_requests integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_window_start timestamptz;
  v_count integer;
begin
  if v_user is null then
    return false;
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  -- Opportunistic cleanup of expired windows for this user/route.
  delete from public.api_usage_counters
  where user_id = v_user and route = p_route and window_start < v_window_start;

  insert into public.api_usage_counters as c (user_id, route, window_start, request_count)
  values (v_user, p_route, v_window_start, 1)
  on conflict (user_id, route, window_start)
  do update set request_count = c.request_count + 1, updated_at = now()
  returning request_count into v_count;

  return v_count <= p_max_requests;
end;
$$;

revoke all on function public.consume_api_quota(text, integer, integer) from public;
grant execute on function public.consume_api_quota(text, integer, integer) to authenticated;
