-- Cellar Management Features Migration
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Add location_mode to cellars
ALTER TABLE cellars ADD COLUMN IF NOT EXISTS location_mode TEXT DEFAULT 'simple';

-- Add constraint if it doesn't exist (may fail if already exists)
DO $$ BEGIN
  ALTER TABLE cellars ADD CONSTRAINT cellars_location_mode_check
    CHECK (location_mode IN ('simple', 'structured', 'grid'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add low stock alert columns to cellar_inventory
ALTER TABLE cellar_inventory ADD COLUMN IF NOT EXISTS low_stock_threshold INT DEFAULT NULL;
ALTER TABLE cellar_inventory ADD COLUMN IF NOT EXISTS low_stock_alert_enabled BOOLEAN DEFAULT false;

-- 3. Add notification preferences to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{
  "drinking_window_in_app": true,
  "drinking_window_push": false,
  "drinking_window_email": false,
  "low_stock_in_app": true,
  "low_stock_push": false,
  "email_digest_day": "sunday"
}'::jsonb;

-- 4. Add simple_location text field to cellar_inventory for simple mode
ALTER TABLE cellar_inventory ADD COLUMN IF NOT EXISTS simple_location TEXT DEFAULT NULL;

-- 5. Add name field to cellar_locations for better display
ALTER TABLE cellar_locations ADD COLUMN IF NOT EXISTS name TEXT DEFAULT NULL;

-- 6. Create notification_log table
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  inventory_id UUID REFERENCES cellar_inventory(id) ON DELETE SET NULL,
  channel TEXT NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Add RLS to notification_log
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notifications" ON notification_log
  FOR ALL USING (user_id = auth.uid());

-- Create index for notification queries
CREATE INDEX IF NOT EXISTS idx_notification_log_user ON notification_log(user_id, sent_at DESC);
