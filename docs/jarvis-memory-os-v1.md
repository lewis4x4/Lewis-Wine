# JARVIS Memory OS v1

## What shipped

Phase 1 adds a self-contained JARVIS Memory OS slice on top of the existing Pourfolio app:

- `/jarvis` overview dashboard
- `/jarvis/capture` canonical capture intake
- `/jarvis/commitments` commitments ledger
- `/jarvis/timeline` operating timeline
- `/jarvis/briefing` latest daily brief surface
- `POST /api/jarvis/capture` write path for capture events plus primary text artifacts

The slice coexists with the wine app under the existing dashboard shell and does not replace or rename any wine routes.

## Data model

Migration: `supabase/migrations/00009_jarvis_memory_os.sql`

Core tables:

- `capture_events`
  - Canonical intake record for a note, transcript, or manual capture
  - Stores source type, business lane, title, preview, participants, happened timestamp, and metadata
- `artifacts`
  - Stores the primary text body and future attachment/link artifacts
  - Phase 1 writes one `primary_text` artifact per capture
- `timeline_events`
  - Chronological operating history used by `/jarvis/timeline`
  - Phase 1 capture writes also append a timeline event
- `commitments`
  - Follow-ups, deliverables, and relationship commitments with status, priority, due date, and source linkage
- `decisions`
  - Durable decision log with summary, rationale, impact, and optional source capture link
- `daily_briefs`
  - A date-keyed daily read with summary, priorities, blockers, and watch items

Schema choices:

- Ownership is single-user by `owner_id -> profiles.id`
- RLS is enabled on every JARVIS table with `owner_id = auth.uid()` policies
- Check constraints are used for lane/status/type fields to match the existing schema style
- Indexes favor owner-scoped descending timeline and dashboard reads
- `updated_at` triggers reuse the existing `update_updated_at()` function

## App architecture

Server/domain layer:

- `src/lib/jarvis/server.ts`
  - Detects live vs fallback mode
  - Returns a typed access contract for pages and route handlers
- `src/lib/jarvis/queries.ts`
  - Server-only page queries with typed empty-state fallbacks
  - Returns presentation-friendly view models for overview, commitments, timeline, capture, and briefing
- `src/lib/jarvis/mutations.ts`
  - Writes a capture event, primary text artifact, and best-effort timeline event
- `src/lib/jarvis/constants.ts`
  - Business lanes, statuses, priorities, and badge metadata
- `src/lib/jarvis/format.ts`
  - Date formatting, participant normalization, and capture preview helpers
- `src/lib/jarvis/validators.ts`
  - Shared capture validation contract

UI layer:

- `src/app/(dashboard)/jarvis/**`
  - Route group pages and JARVIS sub-navigation
- `src/components/jarvis/**`
  - Premium read components for metrics, captures, commitments, timeline, briefing, and empty states

Fallback behavior:

- If Supabase env vars are missing, pages still render with typed empty states and a clear status banner
- If the JARVIS schema is not migrated yet, server queries degrade safely instead of hard-failing the route
- The capture API returns a typed preview response when live persistence is unavailable

## Demo seed

Optional script:

- `npm run db:seed:jarvis`

Required env:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JARVIS_DEMO_USER_ID`

The script clears existing JARVIS records for that user, then inserts a small coherent demo set across captures, artifacts, decisions, commitments, briefs, and timeline events.

## Phase 1 boundaries

Included:

- Read surfaces for all five pages
- Real capture persistence path
- Typed server queries and fallbacks
- Schema, RLS, and demo seed support

Not included yet:

- CRUD editors for commitments, decisions, and briefs
- Automatic synthesis from captures into commitments/decisions/briefs
- Search, embeddings, retrieval ranking, or summarization pipelines
- Attachment uploads beyond text artifacts
- Cross-linking between wine data and executive memory surfaces

## Logical next phases

1. Promote captured items into commitments and decisions from the UI.
2. Generate a daily brief from recent captures, open commitments, and decision deltas.
3. Add search and retrieval over artifacts plus evidence trails on every surface.
4. Introduce relationship memory, meeting packs, and proactive reminders.
