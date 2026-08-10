-- =====================================================
-- MIGRATION 001: Messages avancés
-- =====================================================

-- Soft delete
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_by UUID;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Éphémères
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ephemeral BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Fichiers
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_name TEXT;

-- Réactions
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '{}';

-- Réponse (reply)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to INTEGER REFERENCES messages(id);

-- Épinglage
ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;

-- Édition
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT FALSE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

-- Vocaux
ALTER TABLE messages ADD COLUMN IF NOT EXISTS audio_url TEXT;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_audio BOOLEAN DEFAULT FALSE;

-- =====================================================
-- MIGRATION 002: Push subscriptions
-- =====================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- MIGRATION 003: Audit logs
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

-- =====================================================
-- MIGRATION 004: Database indexes (performance)
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(sender_id, receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(receiver_id, read) WHERE read = false;
CREATE INDEX IF NOT EXISTS idx_messages_deleted ON messages(deleted) WHERE deleted = true;
CREATE INDEX IF NOT EXISTS idx_messages_pinned ON messages(pinned) WHERE pinned = true;
CREATE INDEX IF NOT EXISTS idx_profils_role ON profils(role);
CREATE INDEX IF NOT EXISTS idx_profils_email ON profils(email);
CREATE INDEX IF NOT EXISTS idx_offres_statut ON offres(statut);
CREATE INDEX IF NOT EXISTS idx_missions_entreprise ON missions(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_missions_statut ON missions(statut);

-- =====================================================
-- MIGRATION 005: RPC functions
-- =====================================================

-- Cleanup éphémères
CREATE OR REPLACE FUNCTION delete_expired_ephemeral_messages()
RETURNS void AS $$
  DELETE FROM messages WHERE ephemeral = true AND expires_at < NOW();
$$ LANGUAGE sql;

-- =====================================================
-- MIGRATION 006: Storage buckets
-- =====================================================

INSERT INTO storage.buckets (id, name, public) VALUES ('chat-files', 'chat-files', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public) VALUES ('chat-audio', 'chat-audio', true)
ON CONFLICT (id) DO NOTHING;

-- Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read chat files') THEN
    CREATE POLICY "Public read chat files" ON storage.objects FOR SELECT USING (bucket_id = 'chat-files');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth upload chat files') THEN
    CREATE POLICY "Auth upload chat files" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-files' AND auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read chat audio') THEN
    CREATE POLICY "Public read chat audio" ON storage.objects FOR SELECT USING (bucket_id = 'chat-audio');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth upload chat audio') THEN
    CREATE POLICY "Auth upload chat audio" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chat-audio' AND auth.role() = 'authenticated');
  END IF;
END $$;

-- KYC Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-identite', 'kyc-identite', false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-selfies', 'kyc-selfies', false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-entreprises', 'kyc-entreprises', false)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth upload kyc identity') THEN
    CREATE POLICY "Auth upload kyc identity" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kyc-identite' AND auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin read kyc identity') THEN
    CREATE POLICY "Admin read kyc identity" ON storage.objects FOR SELECT USING (bucket_id = 'kyc-identite');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth upload kyc selfies') THEN
    CREATE POLICY "Auth upload kyc selfies" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kyc-selfies' AND auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin read kyc selfies') THEN
    CREATE POLICY "Admin read kyc selfies" ON storage.objects FOR SELECT USING (bucket_id = 'kyc-selfies');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Auth upload kyc entreprises') THEN
    CREATE POLICY "Auth upload kyc entreprises" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'kyc-entreprises' AND auth.role() = 'authenticated');
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin read kyc entreprises') THEN
    CREATE POLICY "Admin read kyc entreprises" ON storage.objects FOR SELECT USING (bucket_id = 'kyc-entreprises');
  END IF;
END $$;

-- =====================================================
-- MIGRATION 007: Two-Factor Authentication
-- =====================================================

CREATE TABLE IF NOT EXISTS two_factor_auth (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  secret TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('totp', 'email')),
  enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE two_factor_auth ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own 2FA') THEN
    CREATE POLICY "Users read own 2FA" ON two_factor_auth FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users update own 2FA') THEN
    CREATE POLICY "Users update own 2FA" ON two_factor_auth FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users insert own 2FA') THEN
    CREATE POLICY "Users insert own 2FA" ON two_factor_auth FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_two_factor_auth_user ON two_factor_auth(user_id);

-- =====================================================
-- MIGRATION 008: KYC Verifications
-- =====================================================

CREATE TABLE IF NOT EXISTS kyc_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  type_compte TEXT NOT NULL,
  statut TEXT NOT NULL DEFAULT 'pending',
  piece_identite_url TEXT NOT NULL,
  selfie_url TEXT NOT NULL,
  document_entreprise_url TEXT,
  motif_rejet TEXT,
  prenom TEXT,
  nom_naissance TEXT,
  date_naissance TEXT,
  nationalite TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE kyc_verifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own KYC') THEN
    CREATE POLICY "Users read own KYC" ON kyc_verifications FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users insert own KYC') THEN
    CREATE POLICY "Users insert own KYC" ON kyc_verifications FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users update own KYC') THEN
    CREATE POLICY "Users update own KYC" ON kyc_verifications FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin full access KYC') THEN
    CREATE POLICY "Admin full access KYC" ON kyc_verifications FOR ALL USING (
      EXISTS (SELECT 1 FROM profils WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_kyc_verifications_user ON kyc_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_verifications_status ON kyc_verifications(statut);
