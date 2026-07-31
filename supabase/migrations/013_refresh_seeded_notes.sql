-- Idempotent: re-running sets same values, no side effects.
-- Restore seeded playground notes to their original long restaurant reviews
-- and ensure 320x320 sizing.

UPDATE notes
SET width = 320,
    height = 320,
    content = CASE author_name
      WHEN 'Sarah M.' THEN 'The truffle risotto was absolutely divine. Creamy, rich, and perfectly seasoned. We will definitely be back!'
      WHEN 'James K.' THEN 'Best sushi I''ve had in the city. The omakase experience was worth every penny. Incredible attention to detail.'
      WHEN 'Maria L.' THEN 'Cozy atmosphere and the lasagna tasted just like my grandmother''s recipe. A real hidden gem — bring the whole family!'
    END
WHERE wall_id = (SELECT id FROM walls WHERE slug = 'playground')
  AND author_name IN ('Sarah M.', 'James K.', 'Maria L.');
