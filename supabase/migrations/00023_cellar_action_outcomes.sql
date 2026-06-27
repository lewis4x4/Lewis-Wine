-- Portfolio Radar outcome ledger for the Outcome and Learning Loop v1.
-- Outcomes are first-party action results only: outcome_only_no_source_truth_overwrite.
-- They may suppress/reprioritize Radar actions, but they must not rewrite trusted drink-window or valuation evidence.

create table if not exists public.cellar_action_outcomes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  action_dedupe_key text not null,
  action_type text not null check (action_type in (
    'drink_now',
    'at_risk_past_peak',
    'missing_drink_window',
    'review_price_evidence',
    'refresh_valuation',
    'sell_watch',
    'replenish',
    'acquisition_buy',
    'acquisition_watch',
    'close_receipt',
    'capture_tasting_memory',
    'investigate_missing_evidence'
  )),
  subject_type text not null check (subject_type in ('cellar_item','acquisition_target','receipt','tasting_memory')),
  subject_id text not null,
  result_type text not null check (result_type in ('opened','dismissed','skipped')),
  source_surface text check (source_surface is null or source_surface in (
    'cellar_command_center',
    'portfolio_truth',
    'replenishment_automation',
    'acquisition_engine',
    'acquisition_receipt',
    'tasting_memory'
  )),
  maturity_feedback text check (maturity_feedback is null or maturity_feedback in ('too_young','ideal','fading','dead')),
  suppress_until timestamptz,
  notes text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint cellar_action_outcomes_policy_check check (
    not (raw_payload ? 'evidencePolicy')
    or raw_payload->>'evidencePolicy' = 'outcome_only_no_source_truth_overwrite'
  )
);

create index if not exists idx_cellar_action_outcomes_owner_created
  on public.cellar_action_outcomes(owner_id, created_at desc);

create index if not exists idx_cellar_action_outcomes_owner_subject
  on public.cellar_action_outcomes(owner_id, subject_type, subject_id, created_at desc);

create unique index if not exists idx_cellar_action_outcomes_owner_action_result
  on public.cellar_action_outcomes(owner_id, action_dedupe_key, result_type);

alter table public.cellar_action_outcomes enable row level security;

drop policy if exists "Users can manage their cellar action outcomes" on public.cellar_action_outcomes;
create policy "Users can manage their cellar action outcomes"
  on public.cellar_action_outcomes
  for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
