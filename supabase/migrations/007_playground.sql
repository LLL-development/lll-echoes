-- Expand wall mode to include PLAYGROUND
ALTER TABLE walls DROP CONSTRAINT IF EXISTS walls_mode_check;
ALTER TABLE walls ADD CONSTRAINT walls_mode_check
  CHECK (mode IN ('ORGANIZATION', 'PUBLIC', 'PLAYGROUND'));

-- Add content column early so seed notes can use it
ALTER TABLE notes ADD COLUMN IF NOT EXISTS content text;

-- Idempotent seed: playground wall
INSERT INTO walls (slug, edit_token, mode, theme, allow_contributions, title, description)
SELECT 'playground',
       encode(sha256('playground-fixed-token'::bytea), 'hex'),
       'PLAYGROUND',
       'testimonials',
       true,
       'Playground',
       'Try out Echoes — notes disappear after 24 hours'
WHERE NOT EXISTS (SELECT 1 FROM walls WHERE slug = 'playground');

-- Seed 3 restaurant review notes with sticky-note notepad backgrounds
-- Only seed when playground has no seeded notes yet (author_name = 'Echoes' or content-bearing notes)
INSERT INTO notes (wall_id, image_url, content, x, y, width, height, rotation, author_name)
SELECT w.id, '/themes/sticky-note/2.webp',
       'The truffle risotto was absolutely divine. Creamy, rich, and perfectly seasoned. We will definitely be back!',
       40, 60, 200, 140, -3, 'Sarah M.'
FROM walls w WHERE w.slug = 'playground'
  AND NOT EXISTS (
    SELECT 1 FROM notes n WHERE n.wall_id = w.id AND n.author_name = 'Sarah M.'
  )
UNION ALL
SELECT w.id, '/themes/sticky-note/3.webp',
       'Best sushi I''ve had in the city. The omakase experience was worth every penny. Incredible attention to detail.',
       260, 120, 220, 150, 5, 'James K.'
FROM walls w WHERE w.slug = 'playground'
  AND NOT EXISTS (
    SELECT 1 FROM notes n WHERE n.wall_id = w.id AND n.author_name = 'James K.'
  )
UNION ALL
SELECT w.id, '/themes/sticky-note/5.webp',
       'Cozy atmosphere and the lasagna tasted just like my grandmother''s recipe. A real hidden gem — bring the whole family!',
       500, 80, 210, 140, -2, 'Maria L.'
FROM walls w WHERE w.slug = 'playground'
  AND NOT EXISTS (
    SELECT 1 FROM notes n WHERE n.wall_id = w.id AND n.author_name = 'Maria L.'
  );
