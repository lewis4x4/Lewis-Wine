-- Brian-fit personalization layer
-- Safe additive migration for existing Pourfolio accounts

CREATE TABLE IF NOT EXISTS brian_taste_profiles (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  preferred_smoothness INT CHECK (preferred_smoothness BETWEEN 1 AND 5),
  preferred_boldness INT CHECK (preferred_boldness BETWEEN 1 AND 5),
  preferred_earthiness INT CHECK (preferred_earthiness BETWEEN 1 AND 5),
  preferred_spiciness INT CHECK (preferred_spiciness BETWEEN 1 AND 5),
  preferred_fruit_forward INT CHECK (preferred_fruit_forward BETWEEN 1 AND 5),
  preferred_dryness INT CHECK (preferred_dryness BETWEEN 1 AND 5),
  preferred_tannin_strength INT CHECK (preferred_tannin_strength BETWEEN 1 AND 5),
  preferred_acidity_level INT CHECK (preferred_acidity_level BETWEEN 1 AND 5),
  preferred_finish_length INT CHECK (preferred_finish_length BETWEEN 1 AND 5),
  preferred_richness INT CHECK (preferred_richness BETWEEN 1 AND 5),
  confidence_score INT DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 100),
  profile_summary TEXT,
  favorite_descriptors TEXT[] DEFAULT '{}',
  avoid_descriptors TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rating_signals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rating_id UUID NOT NULL UNIQUE REFERENCES ratings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  smoothness INT CHECK (smoothness BETWEEN 1 AND 5),
  boldness INT CHECK (boldness BETWEEN 1 AND 5),
  earthiness INT CHECK (earthiness BETWEEN 1 AND 5),
  spiciness INT CHECK (spiciness BETWEEN 1 AND 5),
  fruit_forward INT CHECK (fruit_forward BETWEEN 1 AND 5),
  dryness INT CHECK (dryness BETWEEN 1 AND 5),
  tannin_strength INT CHECK (tannin_strength BETWEEN 1 AND 5),
  acidity_level INT CHECK (acidity_level BETWEEN 1 AND 5),
  finish_length INT CHECK (finish_length BETWEEN 1 AND 5),
  richness INT CHECK (richness BETWEEN 1 AND 5),
  buy_again BOOLEAN DEFAULT NULL,
  value_feel TEXT CHECK (value_feel IN ('poor', 'fair', 'good', 'strong', 'excellent')),
  decision_tags TEXT[] DEFAULT '{}',
  occasion_tags TEXT[] DEFAULT '{}',
  brian_phrases TEXT[] DEFAULT '{}',
  extracted_from_text JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE brian_taste_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rating_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own brian taste profile" ON brian_taste_profiles
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can manage own rating signals" ON rating_signals
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_rating_signals_user ON rating_signals(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rating_signals_tags ON rating_signals USING GIN(decision_tags);
CREATE INDEX IF NOT EXISTS idx_rating_signals_phrases ON rating_signals USING GIN(brian_phrases);

CREATE TRIGGER set_updated_at BEFORE UPDATE ON brian_taste_profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON rating_signals
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
