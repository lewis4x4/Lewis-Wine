# Production security checklist

Manual steps that pair with the 2026-07-01 lockdown commits — these live in
the Supabase/Netlify dashboards, not the repo, so code alone can't enforce
them.

## Supabase dashboard
- [ ] **Disable public signup** (Authentication → Providers → Email →
      "Allow new users to sign up" off; same for Google OAuth). This is a
      single-user app; any self-registered account can reach authenticated AI
      endpoints. `supabase/config.toml` only governs local dev.
- [x] **Apply migrations 00024–00026** (`consumption ledger`,
      `write-path idempotency`, `api_usage_counters`). Applied 2026-07-01 and
      verified in production: RLS enabled on both new tables, both
      idempotency columns present, `idx_wines_identity_unique` live and the
      old plain `idx_wines_dedupe` dropped, `authenticated` can execute
      `consume_api_quota`. Also confirmed 00022/00023 were already applied —
      the roadmap status table's claim that 00022 never reached production
      was stale/incorrect.
- [ ] **Undeploy the deleted edge functions**: `capture-wine` and `find-more`
      were removed from the repo (dead code; capture-wine called Claude Vision
      with no auth). If they were ever deployed:
      `supabase functions delete capture-wine && supabase functions delete find-more`
- [ ] **Redeploy `advise-list` and `refresh-profile`** so the gated
      fixture-owner fallback takes effect, and confirm both are deployed
      **with JWT verification on** (no `--no-verify-jwt`).
- [ ] **Ensure `POURFOLIO_FIXTURE_OWNER_ID` and `POURFOLIO_LLM_FIXTURE` are
      not set** in production function secrets.
- [ ] **Make the `wine-photos` bucket private** with an owner-folder policy
      (mirroring `wine-evidence`); photo URLs are currently public
      (`photos/upload` uses `getPublicUrl`). The signed-URL read refactor is
      tracked as follow-up work.

## Netlify dashboard
- [ ] Verify the committed `netlify.toml` (build command, Node 22, functions
      dir) matches the UI settings before merging to main.
- [ ] Confirm `POURFOLIO_CRON_SECRET` is set so the scheduled Portfolio Radar
      refresh keeps failing closed rather than open.

## In-repo protections now active
- All 4 AI endpoints are rate-limited durably via the `consume_api_quota`
  RPC (label scan and receipt scan per-minute; bottle-intelligence refresh
  and acquisition engine share a 40/day web-search budget).
- Edge functions no longer fall back to the fixture owner unless
  `POURFOLIO_LLM_FIXTURE=1` is explicitly set.
- Supabase clients and middleware fail loudly in production when env vars
  are missing instead of serving placeholder data.
