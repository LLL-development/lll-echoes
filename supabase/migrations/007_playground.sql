-- Expand wall mode to include PLAYGROUND
ALTER TABLE walls DROP CONSTRAINT IF EXISTS walls_mode_check;
ALTER TABLE walls ADD CONSTRAINT walls_mode_check
  CHECK (mode IN ('ORGANIZATION', 'PUBLIC', 'PLAYGROUND'));

-- Idempotent seed: playground wall
INSERT INTO walls (slug, edit_token, mode, theme, allow_contributions, title, description, embed_bg_color)
SELECT 'playground',
       encode(sha256('playground-fixed-token'::bytea), 'hex'),
       'PLAYGROUND',
       'testimonials',
       true,
       'Playground',
       'Try out Echoes — notes disappear after 24 hours',
       '#ffffff'
WHERE NOT EXISTS (SELECT 1 FROM walls WHERE slug = 'playground');

-- Seed example notes only when playground exists and is empty
INSERT INTO notes (wall_id, image_url, x, y, width, height, rotation, author_name)
SELECT w.id, NULL, 40, 60, 160, 120, -3, 'Echoes'
FROM walls w WHERE w.slug = 'playground'
  AND NOT EXISTS (SELECT 1 FROM notes WHERE wall_id = w.id)
UNION ALL
SELECT w.id, NULL, 220, 120, 150, 110, 5, 'Echoes'
FROM walls w WHERE w.slug = 'playground'
  AND NOT EXISTS (SELECT 1 FROM notes WHERE wall_id = w.id)
UNION ALL
SELECT w.id, NULL, 400, 80, 160, 130, -2, 'Echoes'
FROM walls w WHERE w.slug = 'playground'
  AND NOT EXISTS (SELECT 1 FROM notes WHERE wall_id = w.id);
