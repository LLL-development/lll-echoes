-- Idempotent: re-running sets same values, no side effects.
-- Resize seeded playground notepad notes to 400x400 and refresh review text
UPDATE notes
SET width = 400,
    height = 400,
    content = CASE author_name
      WHEN 'Sarah M.' THEN 'Great food and friendly service. Would definitely come back again!'
      WHEN 'James K.' THEN 'Really enjoyed the food here. Nice atmosphere and good service.'
      WHEN 'Maria L.' THEN 'Delicious food, generous portions, and a pleasant dining experience.'
    END
WHERE wall_id = (SELECT id FROM walls WHERE slug = 'playground')
  AND author_name IN ('Sarah M.', 'James K.', 'Maria L.');
