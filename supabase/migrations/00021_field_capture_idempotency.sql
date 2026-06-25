-- Field capture idempotency for flaky mobile/offline retries.
-- Scope keys per user so a repeated client save returns the existing result instead of
-- creating duplicate capture tastings, cellar ratings, or rating signals.

ALTER TABLE public.tastings
  ADD COLUMN IF NOT EXISTS field_capture_idempotency_key TEXT;

ALTER TABLE public.ratings
  ADD COLUMN IF NOT EXISTS field_capture_idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tastings_field_capture_idempotency
  ON public.tastings(owner_id, field_capture_idempotency_key)
  WHERE field_capture_idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ratings_field_capture_idempotency
  ON public.ratings(user_id, field_capture_idempotency_key)
  WHERE field_capture_idempotency_key IS NOT NULL;
