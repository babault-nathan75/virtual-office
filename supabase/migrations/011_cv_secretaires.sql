ALTER TABLE profils_secretaires ADD COLUMN IF NOT EXISTS cv_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('cv', 'cv', true)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Secretary upload own cv" ON storage.objects;
CREATE POLICY "Secretary upload own cv" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cv' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Secretary update own cv" ON storage.objects;
CREATE POLICY "Secretary update own cv" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'cv' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Public read cv" ON storage.objects;
CREATE POLICY "Public read cv" ON storage.objects
  FOR SELECT USING (bucket_id = 'cv');
