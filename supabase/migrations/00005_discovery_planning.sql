-- Discovery & Planning Features Migration
-- Adds wishlist, shopping list, and winery visit log functionality

-- ============================================
-- 1. WISHLIST - Wines you want to buy
-- ============================================
CREATE TABLE IF NOT EXISTS wishlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Wine reference (optional - can be custom entry)
  wine_reference_id UUID REFERENCES wine_reference(id) ON DELETE SET NULL,

  -- Custom wine details (when not from reference)
  custom_name TEXT,
  custom_producer TEXT,
  custom_region TEXT,
  custom_vintage INT,
  custom_wine_type TEXT CHECK (custom_wine_type IN ('red', 'white', 'rose', 'sparkling', 'dessert', 'fortified')),

  -- Wishlist-specific fields
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'must-have')),
  target_price_cents INT,
  max_price_cents INT,
  desired_quantity INT DEFAULT 1,

  -- Discovery context
  source TEXT,
  -- Where you heard about it: "restaurant", "friend", "article", "tasting", "winery-visit", etc.
  source_details TEXT,
  -- e.g., "Recommended by sommelier at French Laundry"

  -- Notes
  notes TEXT,

  -- Status tracking
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'purchased', 'unavailable', 'removed')),
  purchased_date DATE,
  purchased_price_cents INT,
  purchased_from TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. SHOPPING LIST - Wines to restock
-- ============================================
CREATE TABLE IF NOT EXISTS shopping_list (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Wine reference (from cellar inventory or wine reference)
  inventory_id UUID REFERENCES cellar_inventory(id) ON DELETE SET NULL,
  wine_reference_id UUID REFERENCES wine_reference(id) ON DELETE SET NULL,

  -- Custom wine details (when not from reference)
  custom_name TEXT,
  custom_producer TEXT,
  custom_vintage INT,

  -- Shopping details
  quantity_needed INT DEFAULT 1,
  urgency TEXT DEFAULT 'normal' CHECK (urgency IN ('low', 'normal', 'high', 'urgent')),

  -- Price tracking
  last_purchase_price_cents INT,
  target_price_cents INT,

  -- Preferred vendors
  preferred_vendors TEXT[],

  -- Notes
  notes TEXT,
  reason TEXT,
  -- e.g., "Running low", "For upcoming dinner party", "Holiday gift"

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'purchased', 'cancelled')),
  purchased_date DATE,
  purchased_quantity INT,
  purchased_price_cents INT,
  purchased_from TEXT,

  -- Auto-generated from low stock alerts
  auto_generated BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. WINERY VISITS - Track tastings and purchases
-- ============================================
CREATE TABLE IF NOT EXISTS winery_visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Winery info
  winery_name TEXT NOT NULL,
  winery_region TEXT,
  winery_country TEXT,
  winery_website TEXT,
  winery_address TEXT,

  -- Visit details
  visit_date DATE NOT NULL,
  visit_type TEXT DEFAULT 'tasting' CHECK (visit_type IN ('tasting', 'tour', 'tour-and-tasting', 'pickup', 'event', 'other')),
  reservation_required BOOLEAN,
  tasting_fee_cents INT,
  tasting_fee_waived BOOLEAN DEFAULT false,

  -- Experience
  overall_rating INT CHECK (overall_rating >= 1 AND overall_rating <= 5),
  atmosphere_rating INT CHECK (atmosphere_rating >= 1 AND atmosphere_rating <= 5),
  service_rating INT CHECK (service_rating >= 1 AND service_rating <= 5),
  wine_quality_rating INT CHECK (wine_quality_rating >= 1 AND wine_quality_rating <= 5),
  value_rating INT CHECK (value_rating >= 1 AND value_rating <= 5),

  -- Companions
  companions TEXT[],

  -- Notes
  highlights TEXT,
  notes TEXT,
  would_return BOOLEAN,
  recommended_for TEXT,
  -- e.g., "couples", "groups", "serious collectors"

  -- Photos (URLs)
  photo_urls TEXT[],

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. WINERY VISIT WINES - Wines tasted during visit
-- ============================================
CREATE TABLE IF NOT EXISTS winery_visit_wines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  visit_id UUID NOT NULL REFERENCES winery_visits(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Wine reference (optional)
  wine_reference_id UUID REFERENCES wine_reference(id) ON DELETE SET NULL,

  -- Wine details
  wine_name TEXT NOT NULL,
  wine_type TEXT CHECK (wine_type IN ('red', 'white', 'rose', 'sparkling', 'dessert', 'fortified')),
  vintage INT,

  -- Tasting notes
  rating INT CHECK (rating >= 1 AND rating <= 100),
  tasting_notes TEXT,

  -- Purchase info
  purchased BOOLEAN DEFAULT false,
  quantity_purchased INT,
  price_per_bottle_cents INT,

  -- Wishlist / interest
  added_to_wishlist BOOLEAN DEFAULT false,
  interested_in_buying BOOLEAN DEFAULT false,

  -- Order in tasting flight
  tasting_order INT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. ENABLE ROW LEVEL SECURITY
-- ============================================

ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE winery_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE winery_visit_wines ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. RLS POLICIES - Wishlist
-- ============================================

CREATE POLICY "Users can view their own wishlist" ON wishlist
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert into their own wishlist" ON wishlist
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own wishlist" ON wishlist
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete from their own wishlist" ON wishlist
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 7. RLS POLICIES - Shopping List
-- ============================================

CREATE POLICY "Users can view their own shopping list" ON shopping_list
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert into their own shopping list" ON shopping_list
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shopping list" ON shopping_list
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete from their own shopping list" ON shopping_list
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 8. RLS POLICIES - Winery Visits
-- ============================================

CREATE POLICY "Users can view their own winery visits" ON winery_visits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own winery visits" ON winery_visits
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own winery visits" ON winery_visits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own winery visits" ON winery_visits
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 9. RLS POLICIES - Winery Visit Wines
-- ============================================

CREATE POLICY "Users can view their own winery visit wines" ON winery_visit_wines
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own winery visit wines" ON winery_visit_wines
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own winery visit wines" ON winery_visit_wines
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own winery visit wines" ON winery_visit_wines
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 10. INDEXES FOR PERFORMANCE
-- ============================================

-- Wishlist indexes
CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_status ON wishlist(user_id, status);
CREATE INDEX IF NOT EXISTS idx_wishlist_priority ON wishlist(user_id, priority);

-- Shopping list indexes
CREATE INDEX IF NOT EXISTS idx_shopping_list_user ON shopping_list(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_status ON shopping_list(user_id, status);
CREATE INDEX IF NOT EXISTS idx_shopping_list_urgency ON shopping_list(user_id, urgency);

-- Winery visits indexes
CREATE INDEX IF NOT EXISTS idx_winery_visits_user ON winery_visits(user_id);
CREATE INDEX IF NOT EXISTS idx_winery_visits_date ON winery_visits(user_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_winery_visits_winery ON winery_visits(user_id, winery_name);

-- Winery visit wines indexes
CREATE INDEX IF NOT EXISTS idx_winery_visit_wines_visit ON winery_visit_wines(visit_id);
CREATE INDEX IF NOT EXISTS idx_winery_visit_wines_user ON winery_visit_wines(user_id);

-- ============================================
-- 11. UPDATE TRIGGERS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_wishlist_updated_at ON wishlist;
CREATE TRIGGER update_wishlist_updated_at
  BEFORE UPDATE ON wishlist
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_shopping_list_updated_at ON shopping_list;
CREATE TRIGGER update_shopping_list_updated_at
  BEFORE UPDATE ON shopping_list
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_winery_visits_updated_at ON winery_visits;
CREATE TRIGGER update_winery_visits_updated_at
  BEFORE UPDATE ON winery_visits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
