-- Tasting Experience Enhancement Migration
-- Adds structured tasting notes, food pairings, occasions, and social context

-- Add new columns to ratings table for structured tasting notes
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS aroma_notes JSONB DEFAULT '{}';
-- Structure: { primary: string[], secondary: string[], tertiary: string[] }
-- Example: { primary: ["cherry", "plum"], secondary: ["vanilla", "oak"], tertiary: ["leather", "tobacco"] }

ALTER TABLE ratings ADD COLUMN IF NOT EXISTS body TEXT CHECK (body IN ('light', 'medium-light', 'medium', 'medium-full', 'full'));
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS tannins TEXT CHECK (tannins IN ('none', 'low', 'medium-low', 'medium', 'medium-high', 'high'));
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS acidity TEXT CHECK (acidity IN ('low', 'medium-low', 'medium', 'medium-high', 'high'));
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS sweetness TEXT CHECK (sweetness IN ('bone-dry', 'dry', 'off-dry', 'medium-sweet', 'sweet'));
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS finish TEXT CHECK (finish IN ('short', 'medium', 'long', 'very-long'));
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS intensity TEXT CHECK (intensity IN ('delicate', 'moderate', 'powerful'));

-- Overall impression / quality level
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS quality_level TEXT CHECK (quality_level IN ('poor', 'acceptable', 'good', 'very-good', 'outstanding', 'exceptional'));

-- Social context - who you drank with
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS companions TEXT[];
-- Example: ["Sarah", "John", "Wine Club Friends"]

-- Occasion tags (expanded from simple text to array of tags)
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS occasion_tags TEXT[];
-- Example: ["date-night", "anniversary", "tuesday-dinner"]

-- Location/venue where tasted
ALTER TABLE ratings ADD COLUMN IF NOT EXISTS venue TEXT;
-- Example: "Home", "The French Laundry", "Wine Club Meeting"

-- Create food_pairings table for detailed pairing tracking
CREATE TABLE IF NOT EXISTS food_pairings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rating_id UUID NOT NULL REFERENCES ratings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- What was paired
  dish_name TEXT NOT NULL,
  dish_category TEXT CHECK (dish_category IN (
    'appetizer', 'soup', 'salad', 'pasta', 'seafood', 'poultry',
    'beef', 'pork', 'lamb', 'game', 'vegetarian', 'cheese', 'dessert', 'other'
  )),
  cuisine_type TEXT,
  -- Example: "Italian", "French", "Japanese", etc.

  -- How good was the pairing
  pairing_rating INT CHECK (pairing_rating >= 1 AND pairing_rating <= 5),
  -- 1 = Poor match, 2 = Below average, 3 = Good, 4 = Very good, 5 = Perfect match

  -- Notes about the pairing
  pairing_notes TEXT,

  -- Would you recommend this pairing?
  would_recommend BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create occasion_presets table for common occasions
CREATE TABLE IF NOT EXISTS occasion_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  -- NULL user_id means it's a system-wide preset

  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  icon TEXT,
  -- Example: "date-night", "celebration", "weeknight-dinner"

  is_default BOOLEAN DEFAULT false,
  -- Default presets show for all users

  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, slug)
);

-- Insert default occasion presets
INSERT INTO occasion_presets (name, slug, icon, is_default, sort_order) VALUES
  ('Weeknight Dinner', 'weeknight-dinner', '🍽️', true, 1),
  ('Weekend Dinner', 'weekend-dinner', '🍷', true, 2),
  ('Date Night', 'date-night', '❤️', true, 3),
  ('Dinner Party', 'dinner-party', '🎉', true, 4),
  ('Special Celebration', 'celebration', '🥂', true, 5),
  ('Anniversary', 'anniversary', '💕', true, 6),
  ('Birthday', 'birthday', '🎂', true, 7),
  ('Holiday', 'holiday', '🎄', true, 8),
  ('Wine Tasting', 'wine-tasting', '🍇', true, 9),
  ('Solo Enjoyment', 'solo', '😌', true, 10),
  ('Business Dinner', 'business', '💼', true, 11),
  ('Casual Gathering', 'casual', '👋', true, 12)
ON CONFLICT DO NOTHING;

-- Create companion_presets table for frequently drinking partners
CREATE TABLE IF NOT EXISTS companion_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  name TEXT NOT NULL,
  relationship TEXT,
  -- Example: "spouse", "friend", "family", "colleague", "wine-club"

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, name)
);

-- Common aromas reference (for autocomplete/suggestions)
CREATE TABLE IF NOT EXISTS aroma_reference (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL CHECK (category IN ('primary', 'secondary', 'tertiary')),
  subcategory TEXT,
  -- For primary: "fruit", "floral", "herbal", "spice"
  -- For secondary: "oak", "fermentation", "malolactic"
  -- For tertiary: "oxidation", "bottle-age", "earth"

  name TEXT NOT NULL,
  wine_types TEXT[],
  -- Which wine types this aroma is common in: ["red", "white", etc.]

  sort_order INT DEFAULT 0,

  UNIQUE(category, name)
);

-- Insert common aroma references
INSERT INTO aroma_reference (category, subcategory, name, wine_types, sort_order) VALUES
  -- Primary - Fruit (Red)
  ('primary', 'fruit', 'Cherry', ARRAY['red'], 1),
  ('primary', 'fruit', 'Raspberry', ARRAY['red', 'rose'], 2),
  ('primary', 'fruit', 'Strawberry', ARRAY['red', 'rose'], 3),
  ('primary', 'fruit', 'Blackberry', ARRAY['red'], 4),
  ('primary', 'fruit', 'Plum', ARRAY['red'], 5),
  ('primary', 'fruit', 'Cassis', ARRAY['red'], 6),
  ('primary', 'fruit', 'Blueberry', ARRAY['red'], 7),

  -- Primary - Fruit (White)
  ('primary', 'fruit', 'Apple', ARRAY['white', 'sparkling'], 10),
  ('primary', 'fruit', 'Pear', ARRAY['white', 'sparkling'], 11),
  ('primary', 'fruit', 'Citrus', ARRAY['white'], 12),
  ('primary', 'fruit', 'Lemon', ARRAY['white'], 13),
  ('primary', 'fruit', 'Lime', ARRAY['white'], 14),
  ('primary', 'fruit', 'Grapefruit', ARRAY['white', 'rose'], 15),
  ('primary', 'fruit', 'Peach', ARRAY['white', 'rose'], 16),
  ('primary', 'fruit', 'Apricot', ARRAY['white', 'dessert'], 17),
  ('primary', 'fruit', 'Tropical Fruit', ARRAY['white'], 18),
  ('primary', 'fruit', 'Melon', ARRAY['white'], 19),

  -- Primary - Floral
  ('primary', 'floral', 'Rose', ARRAY['red', 'rose'], 20),
  ('primary', 'floral', 'Violet', ARRAY['red'], 21),
  ('primary', 'floral', 'Jasmine', ARRAY['white'], 22),
  ('primary', 'floral', 'Orange Blossom', ARRAY['white'], 23),
  ('primary', 'floral', 'Honeysuckle', ARRAY['white'], 24),

  -- Primary - Herbal
  ('primary', 'herbal', 'Green Bell Pepper', ARRAY['red'], 30),
  ('primary', 'herbal', 'Mint', ARRAY['red'], 31),
  ('primary', 'herbal', 'Eucalyptus', ARRAY['red'], 32),
  ('primary', 'herbal', 'Grass', ARRAY['white'], 33),
  ('primary', 'herbal', 'Herbs', ARRAY['red', 'white'], 34),

  -- Secondary - Oak
  ('secondary', 'oak', 'Vanilla', ARRAY['red', 'white'], 40),
  ('secondary', 'oak', 'Toast', ARRAY['red', 'white'], 41),
  ('secondary', 'oak', 'Cedar', ARRAY['red'], 42),
  ('secondary', 'oak', 'Smoke', ARRAY['red', 'white'], 43),
  ('secondary', 'oak', 'Coconut', ARRAY['red', 'white'], 44),
  ('secondary', 'oak', 'Chocolate', ARRAY['red'], 45),
  ('secondary', 'oak', 'Coffee', ARRAY['red'], 46),
  ('secondary', 'oak', 'Caramel', ARRAY['red', 'white', 'dessert'], 47),

  -- Secondary - Fermentation
  ('secondary', 'fermentation', 'Butter', ARRAY['white'], 50),
  ('secondary', 'fermentation', 'Cream', ARRAY['white'], 51),
  ('secondary', 'fermentation', 'Bread/Yeast', ARRAY['sparkling'], 52),
  ('secondary', 'fermentation', 'Brioche', ARRAY['sparkling'], 53),

  -- Tertiary - Aged
  ('tertiary', 'bottle-age', 'Leather', ARRAY['red'], 60),
  ('tertiary', 'bottle-age', 'Tobacco', ARRAY['red'], 61),
  ('tertiary', 'bottle-age', 'Earth', ARRAY['red'], 62),
  ('tertiary', 'bottle-age', 'Mushroom', ARRAY['red'], 63),
  ('tertiary', 'bottle-age', 'Dried Fruit', ARRAY['red', 'dessert'], 64),
  ('tertiary', 'bottle-age', 'Honey', ARRAY['white', 'dessert'], 65),
  ('tertiary', 'bottle-age', 'Nuts', ARRAY['white', 'fortified'], 66),
  ('tertiary', 'oxidation', 'Sherry', ARRAY['fortified'], 67),
  ('tertiary', 'earth', 'Mineral', ARRAY['white', 'red'], 68),
  ('tertiary', 'earth', 'Wet Stone', ARRAY['white'], 69),
  ('tertiary', 'earth', 'Petrol', ARRAY['white'], 70)
ON CONFLICT DO NOTHING;

-- Enable RLS on new tables
ALTER TABLE food_pairings ENABLE ROW LEVEL SECURITY;
ALTER TABLE occasion_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE companion_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE aroma_reference ENABLE ROW LEVEL SECURITY;

-- RLS Policies for food_pairings
CREATE POLICY "Users can view their own food pairings" ON food_pairings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own food pairings" ON food_pairings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own food pairings" ON food_pairings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own food pairings" ON food_pairings
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for occasion_presets
CREATE POLICY "Users can view default and their own occasion presets" ON occasion_presets
  FOR SELECT USING (is_default = true OR auth.uid() = user_id);

CREATE POLICY "Users can insert their own occasion presets" ON occasion_presets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own occasion presets" ON occasion_presets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own occasion presets" ON occasion_presets
  FOR DELETE USING (auth.uid() = user_id AND is_default = false);

-- RLS Policies for companion_presets
CREATE POLICY "Users can view their own companion presets" ON companion_presets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own companion presets" ON companion_presets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own companion presets" ON companion_presets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own companion presets" ON companion_presets
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for aroma_reference (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view aroma reference" ON aroma_reference
  FOR SELECT USING (auth.role() = 'authenticated');

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_food_pairings_rating ON food_pairings(rating_id);
CREATE INDEX IF NOT EXISTS idx_food_pairings_user ON food_pairings(user_id);
CREATE INDEX IF NOT EXISTS idx_occasion_presets_user ON occasion_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_companion_presets_user ON companion_presets(user_id);
CREATE INDEX IF NOT EXISTS idx_aroma_reference_category ON aroma_reference(category);
CREATE INDEX IF NOT EXISTS idx_ratings_occasion_tags ON ratings USING GIN (occasion_tags);
CREATE INDEX IF NOT EXISTS idx_ratings_companions ON ratings USING GIN (companions);
