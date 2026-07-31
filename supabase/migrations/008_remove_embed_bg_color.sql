-- Remove unused embed_bg_color column from walls table
ALTER TABLE walls DROP COLUMN IF EXISTS embed_bg_color;
