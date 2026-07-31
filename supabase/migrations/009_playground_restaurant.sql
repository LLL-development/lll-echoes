-- Add content column for text-based notes (idempotent, may already exist from 007)
ALTER TABLE notes ADD COLUMN IF NOT EXISTS content text;

-- Re-theme the playground wall to a full restaurant theme (title, description, and theme)
UPDATE walls
SET theme = 'restaurant',
    title = 'Restaurant',
    description = 'Share your dining experience with us'
WHERE slug = 'playground';
