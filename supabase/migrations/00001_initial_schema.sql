-- Pourfolio Database Schema
-- Initial migration for wine cellar management app

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  preferences JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wine reference data (populated from LWIN database)
CREATE TABLE wine_reference (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lwin TEXT UNIQUE,
  barcode TEXT,
  name TEXT NOT NULL,
  producer TEXT,
  region TEXT,
  sub_region TEXT,
  country TEXT,
  appellation TEXT,
  grape_varieties TEXT[],
  wine_type TEXT CHECK (wine_type IN ('red', 'white', 'rose', 'sparkling', 'dessert', 'fortified')),
  alcohol_percentage DECIMAL(4,2),
  classification TEXT,
  drink_window_start INT,
  drink_window_end INT,
  critic_scores JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Full-text search
  search_vector TSVECTOR GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(producer, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(region, '')), 'B')
  ) STORED
);

-- User's cellars
CREATE TABLE cellars (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Cellar',
  description TEXT,
  total_bottles INT DEFAULT 0,
  total_value_cents BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cellar locations (physical storage)
CREATE TABLE cellar_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cellar_id UUID NOT NULL REFERENCES cellars(id) ON DELETE CASCADE,
  zone TEXT,
  rack TEXT,
  shelf TEXT,
  position TEXT,
  capacity INT DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wine inventory (bottles in cellar)
CREATE TABLE cellar_inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cellar_id UUID NOT NULL REFERENCES cellars(id) ON DELETE CASCADE,
  wine_reference_id UUID REFERENCES wine_reference(id),
  location_id UUID REFERENCES cellar_locations(id),

  -- Custom wine data (if not from reference)
  custom_name TEXT,
  custom_producer TEXT,
  custom_vintage INT,
  vintage INT,

  -- Inventory
  quantity INT DEFAULT 1 CHECK (quantity >= 0),
  bottle_size_ml INT DEFAULT 750,

  -- Purchase info
  purchase_date DATE,
  purchase_price_cents INT,
  purchase_location TEXT,

  -- Drinking window override
  drink_after DATE,
  drink_before DATE,

  -- Status
  status TEXT DEFAULT 'in_cellar' CHECK (status IN ('in_cellar', 'consumed', 'gifted', 'sold')),
  consumed_date DATE,

  -- Images
  label_image_url TEXT,

  -- Notes
  notes TEXT,
  tags TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wine ratings (multiple per wine for history)
CREATE TABLE ratings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES cellar_inventory(id) ON DELETE CASCADE,
  wine_reference_id UUID REFERENCES wine_reference(id),

  score INT NOT NULL CHECK (score >= 0 AND score <= 100),

  -- Tasting notes
  tasting_notes TEXT,
  appearance_notes TEXT,
  nose_notes TEXT,
  palate_notes TEXT,

  -- Context
  occasion TEXT,
  food_pairing TEXT,
  tasting_date DATE DEFAULT CURRENT_DATE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchase history
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  inventory_id UUID REFERENCES cellar_inventory(id),
  wine_reference_id UUID REFERENCES wine_reference(id),

  quantity INT NOT NULL,
  price_per_bottle_cents INT,
  total_price_cents INT,
  currency TEXT DEFAULT 'USD',

  purchase_date DATE NOT NULL,
  vendor TEXT,
  vendor_type TEXT CHECK (vendor_type IN ('winery', 'retailer', 'auction', 'private', 'other')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- INDEXES
-- =====================

CREATE INDEX idx_wine_ref_barcode ON wine_reference(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_wine_ref_lwin ON wine_reference(lwin) WHERE lwin IS NOT NULL;
CREATE INDEX idx_wine_ref_search ON wine_reference USING gin(search_vector);
CREATE INDEX idx_wine_ref_name_trgm ON wine_reference USING gin(name gin_trgm_ops);
CREATE INDEX idx_inventory_cellar ON cellar_inventory(cellar_id);
CREATE INDEX idx_inventory_status ON cellar_inventory(cellar_id, status);
CREATE INDEX idx_ratings_user ON ratings(user_id);
CREATE INDEX idx_ratings_date ON ratings(user_id, tasting_date DESC);
CREATE INDEX idx_cellars_owner ON cellars(owner_id);

-- =====================
-- ROW LEVEL SECURITY
-- =====================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wine_reference ENABLE ROW LEVEL SECURITY;
ALTER TABLE cellars ENABLE ROW LEVEL SECURITY;
ALTER TABLE cellar_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cellar_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Wine reference is public read
CREATE POLICY "Anyone can read wine reference" ON wine_reference
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert wine reference" ON wine_reference
  FOR INSERT TO authenticated WITH CHECK (true);

-- Cellars policies
CREATE POLICY "Users can view own cellars" ON cellars
  FOR SELECT USING (owner_id = auth.uid());

CREATE POLICY "Users can insert own cellars" ON cellars
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Users can update own cellars" ON cellars
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Users can delete own cellars" ON cellars
  FOR DELETE USING (owner_id = auth.uid());

-- Cellar locations policies
CREATE POLICY "Users can manage cellar locations" ON cellar_locations
  FOR ALL USING (
    cellar_id IN (SELECT id FROM cellars WHERE owner_id = auth.uid())
  );

-- Inventory policies
CREATE POLICY "Users can manage own inventory" ON cellar_inventory
  FOR ALL USING (
    cellar_id IN (SELECT id FROM cellars WHERE owner_id = auth.uid())
  );

-- Ratings policies
CREATE POLICY "Users can manage own ratings" ON ratings
  FOR ALL USING (user_id = auth.uid());

-- Purchases policies
CREATE POLICY "Users can manage own purchases" ON purchases
  FOR ALL USING (user_id = auth.uid());

-- =====================
-- TRIGGERS
-- =====================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON wine_reference
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON cellars
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON cellar_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Cellar totals trigger
CREATE OR REPLACE FUNCTION update_cellar_totals()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE cellars SET
    total_bottles = (
      SELECT COALESCE(SUM(quantity), 0) FROM cellar_inventory
      WHERE cellar_id = COALESCE(NEW.cellar_id, OLD.cellar_id) AND status = 'in_cellar'
    ),
    total_value_cents = (
      SELECT COALESCE(SUM(purchase_price_cents * quantity), 0) FROM cellar_inventory
      WHERE cellar_id = COALESCE(NEW.cellar_id, OLD.cellar_id) AND status = 'in_cellar'
    ),
    updated_at = NOW()
  WHERE id = COALESCE(NEW.cellar_id, OLD.cellar_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cellar_totals
AFTER INSERT OR UPDATE OR DELETE ON cellar_inventory
FOR EACH ROW EXECUTE FUNCTION update_cellar_totals();

-- =====================
-- FUNCTIONS
-- =====================

-- Function to create a default cellar when a user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');

  INSERT INTO cellars (owner_id, name)
  VALUES (NEW.id, 'My Cellar');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile and cellar on signup
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION handle_new_user();
