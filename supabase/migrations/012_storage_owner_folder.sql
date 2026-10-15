-- =====================================================
-- MIGRATION 012: Upload limité au dossier de l'utilisateur
--
-- Les politiques INSERT des buckets KYC et de la messagerie ne vérifiaient
-- que `auth.role() = 'authenticated'` : n'importe quel compte pouvait déposer
-- un fichier sous `<id d'un autre utilisateur>/…` — une traversée de dossier
-- au niveau du stockage (faux document KYC rangé dans le dossier d'autrui,
-- fichier piégé glissé dans l'espace d'un tiers).
--
-- Le code client écrit toujours sous `${userId}/…` (dashboard/kyc,
-- ChatWindow) : restreindre le premier segment du chemin à `auth.uid()` ne
-- change rien pour un usage légitime. C'est la règle déjà appliquée au
-- bucket `cv` par la migration 011.
-- =====================================================

DROP POLICY IF EXISTS "Auth upload kyc identity" ON storage.objects;
CREATE POLICY "Auth upload kyc identity" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-identite' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Auth upload kyc selfies" ON storage.objects;
CREATE POLICY "Auth upload kyc selfies" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-selfies' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Auth upload kyc entreprises" ON storage.objects;
CREATE POLICY "Auth upload kyc entreprises" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'kyc-entreprises' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Auth upload chat files" ON storage.objects;
CREATE POLICY "Auth upload chat files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-files' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Auth upload chat audio" ON storage.objects;
CREATE POLICY "Auth upload chat audio" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-audio' AND (storage.foldername(name))[1] = auth.uid()::text);
