-- Add custom wine type and region fields to cellar_inventory
-- These fields allow storing wine type and region for manually added wines (without wine_reference)

-- Add custom_wine_type column
ALTER TABLE cellar_inventory
ADD COLUMN IF NOT EXISTS custom_wine_type TEXT
CHECK (custom_wine_type IS NULL OR custom_wine_type IN ('red', 'white', 'rose', 'sparkling', 'dessert', 'fortified'));

-- Add custom_region column
ALTER TABLE cellar_inventory
ADD COLUMN IF NOT EXISTS custom_region TEXT;

-- Add comment explaining usage
COMMENT ON COLUMN cellar_inventory.custom_wine_type IS 'Wine type for manually added wines (when wine_reference_id is null)';
COMMENT ON COLUMN cellar_inventory.custom_region IS 'Region for manually added wines (when wine_reference_id is null)';
