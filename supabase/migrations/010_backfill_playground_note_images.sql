-- Cleanup and re-seed for existing databases that already ran old migrations 007 and 009.
-- Old 007 created 3 empty placeholders (image_url=NULL, content=NULL, author_name='Echoes').
-- Old 009 created 3 extra content-only notes (image_url=NULL, content=TEXT).
-- This migration removes all incomplete seed notes and ensures 3 proper notes exist.
-- Idempotent: safe to run multiple times.

-- Step 1: Delete any seeded notes on the playground that are missing image or content
DELETE FROM notes
USING walls
WHERE notes.wall_id = walls.id
  AND walls.slug = 'playground'
  AND notes.author_session_id IS NULL
  AND (notes.image_url IS NULL OR notes.content IS NULL);

-- Step 2: Ensure the 3 restaurant review notes exist with proper backgrounds
INSERT INTO notes (wall_id, image_url, content, x, y, width, height, rotation, author_name)
SELECT w.id, '/themes/sticky-note/2.webp',
        'Great food and friendly service. Would definitely come back again!',
        40, 60, 320, 320, -3, 'Sarah M.'
FROM walls w WHERE w.slug = 'playground'
  AND NOT EXISTS (
    SELECT 1 FROM notes n WHERE n.wall_id = w.id AND n.author_name = 'Sarah M.'
  )
UNION ALL
SELECT w.id, '/themes/sticky-note/3.webp',
        'Really enjoyed the food here. Nice atmosphere and good service.',
        260, 120, 320, 320, 5, 'James K.'
FROM walls w WHERE w.slug = 'playground'
  AND NOT EXISTS (
    SELECT 1 FROM notes n WHERE n.wall_id = w.id AND n.author_name = 'James K.'
  )
UNION ALL
SELECT w.id, '/themes/sticky-note/5.webp',
        'Delicious food, generous portions, and a pleasant dining experience.',
        500, 80, 320, 320, -2, 'Maria L.'
FROM walls w WHERE w.slug = 'playground'
  AND NOT EXISTS (
    SELECT 1 FROM notes n WHERE n.wall_id = w.id AND n.author_name = 'Maria L.'
  );
