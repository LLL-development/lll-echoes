-- Add DELETE RLS policy on notes (004 did not include one, so the anon role
-- cannot delete rows even after application-level auth passes).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'Anyone can delete notes'
  ) THEN
    CREATE POLICY "Anyone can delete notes"
      ON notes FOR DELETE
      USING (true);
  END IF;
END $$;
