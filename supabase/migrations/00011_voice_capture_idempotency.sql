-- Voice capture idempotency for offline sync retries.
-- Keeps JARVIS tasting saves from creating duplicate ratings when a retry follows
-- a partially successful or uncertain network save.

ALTER TABLE ratings
  ADD COLUMN IF NOT EXISTS voice_capture_idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_voice_capture_idempotency
  ON ratings(user_id, voice_capture_idempotency_key)
  WHERE voice_capture_idempotency_key IS NOT NULL;
