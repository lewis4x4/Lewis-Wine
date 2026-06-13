-- JARVIS Memory OS phase 1 schema
-- Core executive memory tables for capture, commitments, decisions, timeline, and briefing.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS capture_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('manual', 'note', 'transcript', 'meeting', 'email', 'document')),
  business_lane TEXT NOT NULL
    CHECK (business_lane IN ('executive', 'product', 'commercial', 'finance', 'operations', 'talent', 'relationships', 'personal')),
  title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  content_preview TEXT,
  participants TEXT[] NOT NULL DEFAULT '{}',
  happened_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  capture_event_id UUID REFERENCES capture_events(id) ON DELETE CASCADE,
  artifact_type TEXT NOT NULL
    CHECK (artifact_type IN ('primary_text', 'summary', 'attachment', 'link', 'brief')),
  title TEXT,
  mime_type TEXT,
  content_text TEXT,
  source_url TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (content_text IS NOT NULL OR source_url IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL
    CHECK (event_type IN ('capture', 'commitment', 'decision', 'brief')),
  business_lane TEXT NOT NULL
    CHECK (business_lane IN ('executive', 'product', 'commercial', 'finance', 'operations', 'talent', 'relationships', 'personal')),
  headline TEXT NOT NULL CHECK (char_length(trim(headline)) > 0),
  summary TEXT,
  happened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_table TEXT
    CHECK (source_table IS NULL OR source_table IN ('capture_events', 'commitments', 'decisions', 'daily_briefs')),
  source_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commitments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_lane TEXT NOT NULL
    CHECK (business_lane IN ('executive', 'product', 'commercial', 'finance', 'operations', 'talent', 'relationships', 'personal')),
  title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'blocked', 'delegated', 'done', 'dropped')),
  priority TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('critical', 'high', 'normal', 'low')),
  commitment_type TEXT NOT NULL DEFAULT 'follow_up'
    CHECK (commitment_type IN ('follow_up', 'decision', 'deliverable', 'relationship', 'finance', 'personal')),
  counterparty TEXT,
  participants TEXT[] NOT NULL DEFAULT '{}',
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  source_capture_event_id UUID REFERENCES capture_events(id) ON DELETE SET NULL,
  source_decision_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (completed_at IS NULL OR completed_at >= created_at)
);

CREATE TABLE IF NOT EXISTS decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_lane TEXT NOT NULL
    CHECK (business_lane IN ('executive', 'product', 'commercial', 'finance', 'operations', 'talent', 'relationships', 'personal')),
  title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  summary TEXT NOT NULL CHECK (char_length(trim(summary)) > 0),
  rationale TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'superseded', 'reversed')),
  impact_level TEXT NOT NULL DEFAULT 'medium'
    CHECK (impact_level IN ('low', 'medium', 'high')),
  decided_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_capture_event_id UUID REFERENCES capture_events(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  brief_date DATE NOT NULL,
  title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  summary TEXT NOT NULL CHECK (char_length(trim(summary)) > 0),
  priorities TEXT[] NOT NULL DEFAULT '{}',
  blockers TEXT[] NOT NULL DEFAULT '{}',
  watch_items TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_id, brief_date)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'commitments_source_decision_id_fkey'
      AND table_name = 'commitments'
  ) THEN
    ALTER TABLE commitments
      ADD CONSTRAINT commitments_source_decision_id_fkey
      FOREIGN KEY (source_decision_id)
      REFERENCES decisions(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_capture_events_owner_created
  ON capture_events(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_capture_events_owner_happened
  ON capture_events(owner_id, happened_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_capture_events_owner_lane
  ON capture_events(owner_id, business_lane);

CREATE INDEX IF NOT EXISTS idx_artifacts_owner_capture
  ON artifacts(owner_id, capture_event_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_artifacts_primary_capture
  ON artifacts(capture_event_id)
  WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_timeline_events_owner_happened
  ON timeline_events(owner_id, happened_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_events_owner_type
  ON timeline_events(owner_id, event_type, happened_at DESC);

CREATE INDEX IF NOT EXISTS idx_commitments_owner_status
  ON commitments(owner_id, status, due_at ASC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_commitments_owner_priority
  ON commitments(owner_id, priority, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_commitments_source_capture
  ON commitments(source_capture_event_id);

CREATE INDEX IF NOT EXISTS idx_decisions_owner_decided
  ON decisions(owner_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_owner_status
  ON decisions(owner_id, status, decided_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_briefs_owner_date
  ON daily_briefs(owner_id, brief_date DESC);

ALTER TABLE capture_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE commitments ENABLE ROW LEVEL SECURITY;
ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_briefs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'capture_events'
      AND policyname = 'Users can manage own capture events'
  ) THEN
    CREATE POLICY "Users can manage own capture events" ON capture_events
      FOR ALL
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'artifacts'
      AND policyname = 'Users can manage own artifacts'
  ) THEN
    CREATE POLICY "Users can manage own artifacts" ON artifacts
      FOR ALL
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'timeline_events'
      AND policyname = 'Users can manage own timeline events'
  ) THEN
    CREATE POLICY "Users can manage own timeline events" ON timeline_events
      FOR ALL
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'commitments'
      AND policyname = 'Users can manage own commitments'
  ) THEN
    CREATE POLICY "Users can manage own commitments" ON commitments
      FOR ALL
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'decisions'
      AND policyname = 'Users can manage own decisions'
  ) THEN
    CREATE POLICY "Users can manage own decisions" ON decisions
      FOR ALL
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'daily_briefs'
      AND policyname = 'Users can manage own daily briefs'
  ) THEN
    CREATE POLICY "Users can manage own daily briefs" ON daily_briefs
      FOR ALL
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_capture_events_updated_at'
  ) THEN
    CREATE TRIGGER set_capture_events_updated_at
      BEFORE UPDATE ON capture_events
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_artifacts_updated_at'
  ) THEN
    CREATE TRIGGER set_artifacts_updated_at
      BEFORE UPDATE ON artifacts
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_commitments_updated_at'
  ) THEN
    CREATE TRIGGER set_commitments_updated_at
      BEFORE UPDATE ON commitments
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_decisions_updated_at'
  ) THEN
    CREATE TRIGGER set_decisions_updated_at
      BEFORE UPDATE ON decisions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_daily_briefs_updated_at'
  ) THEN
    CREATE TRIGGER set_daily_briefs_updated_at
      BEFORE UPDATE ON daily_briefs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;
