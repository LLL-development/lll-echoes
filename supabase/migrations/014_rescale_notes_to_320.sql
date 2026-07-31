-- Idempotent: re-running is a no-op (WHERE clause excludes already-320x320).
-- Resize any existing 400x400 notes (user-created defaults + any prior seeded notes)
-- to 320x320, proportionally smaller without cropping or distortion.
-- Notes the user manually resized in edit mode have non-400x400 dimensions,
-- so they are left untouched.

UPDATE notes
SET width = 320, height = 320
WHERE width = 400 AND height = 400;
