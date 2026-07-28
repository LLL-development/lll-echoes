-- Grant basic table access to anon role
GRANT SELECT, INSERT, UPDATE, DELETE ON walls TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON notes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON note_templates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON _screenshot_cache TO anon;

-- Grant sequence access for auto-incrementing IDs
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO anon;
