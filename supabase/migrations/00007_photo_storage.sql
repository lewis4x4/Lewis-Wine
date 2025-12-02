-- Photo Storage Migration
-- Adds support for storing multiple photos per wine with metadata

-- Create photo_type enum
CREATE TYPE photo_type AS ENUM ('label', 'bottle', 'cork', 'receipt', 'tasting', 'cellar', 'other');

-- Create wine_photos table
CREATE TABLE wine_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    inventory_id UUID REFERENCES cellar_inventory(id) ON DELETE CASCADE,
    rating_id UUID REFERENCES ratings(id) ON DELETE SET NULL,
    visit_id UUID REFERENCES winery_visits(id) ON DELETE SET NULL,

    -- Storage info
    storage_path TEXT NOT NULL,
    url TEXT NOT NULL,
    thumbnail_url TEXT,

    -- Metadata
    photo_type photo_type DEFAULT 'other',
    caption TEXT,
    is_primary BOOLEAN DEFAULT false,

    -- Image dimensions (useful for gallery layouts)
    width INTEGER,
    height INTEGER,
    file_size_bytes INTEGER,
    mime_type TEXT,

    -- Timestamps
    taken_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure at least one reference exists
    CONSTRAINT photo_must_have_reference CHECK (
        inventory_id IS NOT NULL OR rating_id IS NOT NULL OR visit_id IS NOT NULL
    )
);

-- Create indexes
CREATE INDEX idx_wine_photos_user ON wine_photos(user_id);
CREATE INDEX idx_wine_photos_inventory ON wine_photos(inventory_id);
CREATE INDEX idx_wine_photos_rating ON wine_photos(rating_id);
CREATE INDEX idx_wine_photos_visit ON wine_photos(visit_id);
CREATE INDEX idx_wine_photos_type ON wine_photos(photo_type);
CREATE INDEX idx_wine_photos_primary ON wine_photos(inventory_id, is_primary) WHERE is_primary = true;

-- RLS policies
ALTER TABLE wine_photos ENABLE ROW LEVEL SECURITY;

-- Users can view their own photos
CREATE POLICY "Users can view own photos"
    ON wine_photos FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own photos
CREATE POLICY "Users can insert own photos"
    ON wine_photos FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own photos
CREATE POLICY "Users can update own photos"
    ON wine_photos FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own photos
CREATE POLICY "Users can delete own photos"
    ON wine_photos FOR DELETE
    USING (auth.uid() = user_id);

-- Function to ensure only one primary photo per inventory item
CREATE OR REPLACE FUNCTION ensure_single_primary_photo()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary = true AND NEW.inventory_id IS NOT NULL THEN
        -- Remove primary flag from other photos for the same inventory item
        UPDATE wine_photos
        SET is_primary = false
        WHERE inventory_id = NEW.inventory_id
          AND id != NEW.id
          AND is_primary = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ensure_single_primary_photo
    AFTER INSERT OR UPDATE ON wine_photos
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_primary_photo();

-- Update cellar_inventory to have a computed primary photo
-- (We'll use the existing label_image_url field for the primary photo URL)

-- Create function to update label_image_url when primary photo changes
CREATE OR REPLACE FUNCTION sync_primary_photo_to_inventory()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary = true AND NEW.inventory_id IS NOT NULL THEN
        UPDATE cellar_inventory
        SET label_image_url = NEW.url
        WHERE id = NEW.inventory_id;
    END IF;

    -- If primary photo is being removed, clear the label_image_url
    IF TG_OP = 'UPDATE' AND OLD.is_primary = true AND NEW.is_primary = false THEN
        -- Check if there's another primary photo
        IF NOT EXISTS (
            SELECT 1 FROM wine_photos
            WHERE inventory_id = NEW.inventory_id
              AND is_primary = true
              AND id != NEW.id
        ) THEN
            UPDATE cellar_inventory
            SET label_image_url = NULL
            WHERE id = NEW.inventory_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_sync_primary_photo
    AFTER INSERT OR UPDATE ON wine_photos
    FOR EACH ROW
    EXECUTE FUNCTION sync_primary_photo_to_inventory();

-- When a photo is deleted, update inventory if it was primary
CREATE OR REPLACE FUNCTION handle_photo_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_primary = true AND OLD.inventory_id IS NOT NULL THEN
        -- Try to set another photo as primary, or clear the URL
        UPDATE cellar_inventory
        SET label_image_url = (
            SELECT url FROM wine_photos
            WHERE inventory_id = OLD.inventory_id
              AND id != OLD.id
            ORDER BY created_at DESC
            LIMIT 1
        )
        WHERE id = OLD.inventory_id;

        -- If there was another photo, mark it as primary
        UPDATE wine_photos
        SET is_primary = true
        WHERE inventory_id = OLD.inventory_id
          AND id != OLD.id
          AND id = (
              SELECT id FROM wine_photos
              WHERE inventory_id = OLD.inventory_id
                AND id != OLD.id
              ORDER BY created_at DESC
              LIMIT 1
          );
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_handle_photo_deletion
    BEFORE DELETE ON wine_photos
    FOR EACH ROW
    EXECUTE FUNCTION handle_photo_deletion();

-- Storage bucket policies are handled via Supabase dashboard or API
-- The following comment documents the expected bucket configuration:
/*
Storage Bucket: wine-photos
- Public: false (authenticated access only)
- File size limit: 10MB
- Allowed MIME types: image/jpeg, image/png, image/webp, image/heic
- RLS: Users can only access their own photos

Folder structure:
/[user_id]/[inventory_id|rating_id|visit_id]/[uuid].[ext]
*/
