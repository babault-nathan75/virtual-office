-- =====================================================
-- MIGRATION 004: Storage RLS pour les documents KYC
-- Corrige l'erreur 400 à l'upload (politiques INSERT manquantes)
-- Les buckets KYC sont privés : lecture via URLs signées (admin / propriétaire)
-- =====================================================

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ---------------- kyc-identite ----------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Auth upload kyc identity') THEN
    CREATE POLICY "Auth upload kyc identity" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kyc-identite' AND auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Owner read kyc identity') THEN
    CREATE POLICY "Owner read kyc identity" ON storage.objects FOR SELECT USING (bucket_id = 'kyc-identite' AND owner = auth.uid());
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admin read kyc identity docs') THEN
    CREATE POLICY "Admin read kyc identity docs" ON storage.objects FOR SELECT USING (
      bucket_id = 'kyc-identite' AND auth.role() = 'authenticated'
      AND EXISTS (SELECT 1 FROM profils WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- ---------------- kyc-selfies ----------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Auth upload kyc selfies') THEN
    CREATE POLICY "Auth upload kyc selfies" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kyc-selfies' AND auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Owner read kyc selfies') THEN
    CREATE POLICY "Owner read kyc selfies" ON storage.objects FOR SELECT USING (bucket_id = 'kyc-selfies' AND owner = auth.uid());
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admin read kyc selfies docs') THEN
    CREATE POLICY "Admin read kyc selfies docs" ON storage.objects FOR SELECT USING (
      bucket_id = 'kyc-selfies' AND auth.role() = 'authenticated'
      AND EXISTS (SELECT 1 FROM profils WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- ---------------- kyc-entreprises ----------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Auth upload kyc entreprises') THEN
    CREATE POLICY "Auth upload kyc entreprises" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kyc-entreprises' AND auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Owner read kyc entreprises') THEN
    CREATE POLICY "Owner read kyc entreprises" ON storage.objects FOR SELECT USING (bucket_id = 'kyc-entreprises' AND owner = auth.uid());
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='Admin read kyc entreprises docs') THEN
    CREATE POLICY "Admin read kyc entreprises docs" ON storage.objects FOR SELECT USING (
      bucket_id = 'kyc-entreprises' AND auth.role() = 'authenticated'
      AND EXISTS (SELECT 1 FROM profils WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;