-- Add wall customization fields
ALTER TABLE walls ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE walls ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE walls ADD COLUMN IF NOT EXISTS embed_bg_color text DEFAULT '#ffffff';
