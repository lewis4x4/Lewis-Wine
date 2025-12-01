-- Financial Tracking Migration
-- Adds market value tracking, portfolio analytics, and price per glass features

-- Add market value fields to cellar_inventory
ALTER TABLE cellar_inventory ADD COLUMN IF NOT EXISTS current_market_value_cents INT;
-- Estimated current market value per bottle

ALTER TABLE cellar_inventory ADD COLUMN IF NOT EXISTS market_value_source TEXT CHECK (market_value_source IN ('manual', 'wine-searcher', 'vivino', 'estimate'));
-- Where the market value came from

ALTER TABLE cellar_inventory ADD COLUMN IF NOT EXISTS market_value_updated_at TIMESTAMPTZ;
-- When the market value was last updated

ALTER TABLE cellar_inventory ADD COLUMN IF NOT EXISTS is_opened BOOLEAN DEFAULT false;
-- Track if a bottle has been opened (for price per glass)

ALTER TABLE cellar_inventory ADD COLUMN IF NOT EXISTS opened_date DATE;
-- When the bottle was opened

ALTER TABLE cellar_inventory ADD COLUMN IF NOT EXISTS glasses_poured INT DEFAULT 0;
-- Number of glasses poured from an opened bottle

ALTER TABLE cellar_inventory ADD COLUMN IF NOT EXISTS glasses_per_bottle INT DEFAULT 5;
-- How many glasses this bottle yields (standard is 5 for 750ml)

-- Create market_value_history table for tracking value changes over time
CREATE TABLE IF NOT EXISTS market_value_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID NOT NULL REFERENCES cellar_inventory(id) ON DELETE CASCADE,

  value_cents INT NOT NULL,
  source TEXT CHECK (source IN ('manual', 'wine-searcher', 'vivino', 'estimate')),

  -- Optional metadata about the valuation
  source_url TEXT,
  notes TEXT,

  recorded_at TIMESTAMPTZ DEFAULT NOW(),

  -- Create index for querying history
  CONSTRAINT unique_inventory_date UNIQUE (inventory_id, recorded_at)
);

-- Create portfolio_snapshots table for tracking total collection value over time
CREATE TABLE IF NOT EXISTS portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cellar_id UUID NOT NULL REFERENCES cellars(id) ON DELETE CASCADE,

  -- Snapshot data
  total_bottles INT NOT NULL DEFAULT 0,
  total_purchase_value_cents BIGINT NOT NULL DEFAULT 0,
  total_market_value_cents BIGINT NOT NULL DEFAULT 0,

  -- Breakdown by wine type
  value_by_type JSONB DEFAULT '{}',
  -- Structure: { "red": { bottles: 10, purchase: 50000, market: 75000 }, ... }

  -- Breakdown by region/country
  value_by_region JSONB DEFAULT '{}',
  -- Structure: { "Bordeaux": { bottles: 5, purchase: 100000, market: 150000 }, ... }

  snapshot_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_daily_snapshot UNIQUE (cellar_id, snapshot_date)
);

-- Create price_alerts table for notifying users of value changes
CREATE TABLE IF NOT EXISTS price_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  inventory_id UUID NOT NULL REFERENCES cellar_inventory(id) ON DELETE CASCADE,

  alert_type TEXT NOT NULL CHECK (alert_type IN ('threshold_above', 'threshold_below', 'percentage_change')),

  -- For threshold alerts
  threshold_cents INT,

  -- For percentage alerts
  percentage_change DECIMAL(5,2),

  is_active BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE market_value_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for market_value_history
CREATE POLICY "Users can view their own market value history" ON market_value_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cellar_inventory ci
      JOIN cellars c ON ci.cellar_id = c.id
      WHERE ci.id = inventory_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own market value history" ON market_value_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM cellar_inventory ci
      JOIN cellars c ON ci.cellar_id = c.id
      WHERE ci.id = inventory_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own market value history" ON market_value_history
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM cellar_inventory ci
      JOIN cellars c ON ci.cellar_id = c.id
      WHERE ci.id = inventory_id AND c.owner_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own market value history" ON market_value_history
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM cellar_inventory ci
      JOIN cellars c ON ci.cellar_id = c.id
      WHERE ci.id = inventory_id AND c.owner_id = auth.uid()
    )
  );

-- RLS Policies for portfolio_snapshots
CREATE POLICY "Users can view their own portfolio snapshots" ON portfolio_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own portfolio snapshots" ON portfolio_snapshots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own portfolio snapshots" ON portfolio_snapshots
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own portfolio snapshots" ON portfolio_snapshots
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for price_alerts
CREATE POLICY "Users can view their own price alerts" ON price_alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own price alerts" ON price_alerts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own price alerts" ON price_alerts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own price alerts" ON price_alerts
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_market_value_history_inventory ON market_value_history(inventory_id);
CREATE INDEX IF NOT EXISTS idx_market_value_history_date ON market_value_history(recorded_at);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_cellar ON portfolio_snapshots(cellar_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_snapshots_date ON portfolio_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_price_alerts_user ON price_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_price_alerts_inventory ON price_alerts(inventory_id);
CREATE INDEX IF NOT EXISTS idx_cellar_inventory_market_value ON cellar_inventory(current_market_value_cents);

-- Function to calculate total cellar value
CREATE OR REPLACE FUNCTION calculate_cellar_value(cellar_uuid UUID)
RETURNS TABLE (
  total_bottles BIGINT,
  total_purchase_cents BIGINT,
  total_market_cents BIGINT,
  gain_loss_cents BIGINT,
  gain_loss_percentage DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(ci.quantity), 0)::BIGINT as total_bottles,
    COALESCE(SUM(ci.quantity * COALESCE(ci.purchase_price_cents, 0)), 0)::BIGINT as total_purchase_cents,
    COALESCE(SUM(ci.quantity * COALESCE(ci.current_market_value_cents, ci.purchase_price_cents, 0)), 0)::BIGINT as total_market_cents,
    (COALESCE(SUM(ci.quantity * COALESCE(ci.current_market_value_cents, ci.purchase_price_cents, 0)), 0) -
     COALESCE(SUM(ci.quantity * COALESCE(ci.purchase_price_cents, 0)), 0))::BIGINT as gain_loss_cents,
    CASE
      WHEN COALESCE(SUM(ci.quantity * COALESCE(ci.purchase_price_cents, 0)), 0) > 0
      THEN ((COALESCE(SUM(ci.quantity * COALESCE(ci.current_market_value_cents, ci.purchase_price_cents, 0)), 0)::DECIMAL -
             COALESCE(SUM(ci.quantity * COALESCE(ci.purchase_price_cents, 0)), 0)::DECIMAL) /
            COALESCE(SUM(ci.quantity * COALESCE(ci.purchase_price_cents, 0)), 0)::DECIMAL * 100)
      ELSE 0
    END as gain_loss_percentage
  FROM cellar_inventory ci
  WHERE ci.cellar_id = cellar_uuid
    AND ci.status = 'in_cellar';
END;
$$ LANGUAGE plpgsql;
