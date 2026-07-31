-- Add UPDATE RLS policy on notes (004 did not include one)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'notes' AND policyname = 'Anyone can update notes'
  ) THEN
    CREATE POLICY "Anyone can update notes"
      ON notes FOR UPDATE
      USING (true);
  END IF;
END $$;
