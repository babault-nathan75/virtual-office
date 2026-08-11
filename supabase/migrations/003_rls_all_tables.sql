-- =====================================================
-- MIGRATION 009: Enable RLS on all tables
-- =====================================================

-- Enable RLS on all core tables (if not already enabled)
ALTER TABLE profils ENABLE ROW LEVEL SECURITY;
ALTER TABLE profils_secretaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE offres ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_confirmations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- profils policies
-- =====================================================

-- Everyone can read profiles (for search/matching)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read profils') THEN
    CREATE POLICY "Public read profils" ON profils FOR SELECT USING (true);
  END IF;
END $$;

-- Users can update their own profile
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users update own profil') THEN
    CREATE POLICY "Users update own profil" ON profils FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

-- Users can insert their own profile (via service role in API, but RLS as safety net)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users insert own profil') THEN
    CREATE POLICY "Users insert own profil" ON profils FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Admins can do everything on profiles
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin full access profils') THEN
    CREATE POLICY "Admin full access profils" ON profils FOR ALL USING (
      EXISTS (SELECT 1 FROM profils WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- =====================================================
-- profils_secretaires policies
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read secretary profiles') THEN
    CREATE POLICY "Public read secretary profiles" ON profils_secretaires FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Secretary update own profile') THEN
    CREATE POLICY "Secretary update own profile" ON profils_secretaires FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Secretary insert own profile') THEN
    CREATE POLICY "Secretary insert own profile" ON profils_secretaires FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- =====================================================
-- missions policies
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Public read missions') THEN
    CREATE POLICY "Public read missions" ON missions FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Entreprise manage own missions') THEN
    CREATE POLICY "Entreprise manage own missions" ON missions FOR ALL USING (
      auth.uid() = entreprise_id OR
      EXISTS (SELECT 1 FROM profils WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- =====================================================
-- candidatures policies
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Read own candidatures') THEN
    CREATE POLICY "Read own candidatures" ON candidatures FOR SELECT USING (
      secretaire_id = auth.uid() OR
      EXISTS (SELECT 1 FROM missions WHERE id = candidatures.mission_id AND entreprise_id = auth.uid()) OR
      EXISTS (SELECT 1 FROM profils WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Secretary create candidature') THEN
    CREATE POLICY "Secretary create candidature" ON candidatures FOR INSERT WITH CHECK (
      secretaire_id = auth.uid()
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Update candidature status') THEN
    CREATE POLICY "Update candidature status" ON candidatures FOR UPDATE USING (
      EXISTS (SELECT 1 FROM missions WHERE id = candidatures.mission_id AND entreprise_id = auth.uid()) OR
      secretaire_id = auth.uid() OR
      EXISTS (SELECT 1 FROM profils WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- =====================================================
-- offres policies
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Read own offres') THEN
    CREATE POLICY "Read own offres" ON offres FOR SELECT USING (
      entreprise_id = auth.uid() OR
      secretaire_id = auth.uid() OR
      EXISTS (SELECT 1 FROM profils WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Manage offres') THEN
    CREATE POLICY "Manage offres" ON offres FOR ALL USING (
      entreprise_id = auth.uid() OR
      secretaire_id = auth.uid() OR
      EXISTS (SELECT 1 FROM profils WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- =====================================================
-- messages policies
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Read own messages') THEN
    CREATE POLICY "Read own messages" ON messages FOR SELECT USING (
      sender_id = auth.uid() OR receiver_id = auth.uid() OR
      EXISTS (SELECT 1 FROM profils WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Insert own messages') THEN
    CREATE POLICY "Insert own messages" ON messages FOR INSERT WITH CHECK (
      sender_id = auth.uid()
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Update own messages') THEN
    CREATE POLICY "Update own messages" ON messages FOR UPDATE USING (
      sender_id = auth.uid() OR receiver_id = auth.uid()
    );
  END IF;
END $$;

-- =====================================================
-- notifications policies
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Read own notifications') THEN
    CREATE POLICY "Read own notifications" ON notifications FOR SELECT USING (
      user_id = auth.uid()
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Insert notifications') THEN
    CREATE POLICY "Insert notifications" ON notifications FOR INSERT WITH CHECK (
      user_id = auth.uid() OR
      EXISTS (SELECT 1 FROM profils WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Update own notifications') THEN
    CREATE POLICY "Update own notifications" ON notifications FOR UPDATE USING (
      user_id = auth.uid()
    );
  END IF;
END $$;

-- =====================================================
-- push_subscriptions policies
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Read own push subs') THEN
    CREATE POLICY "Read own push subs" ON push_subscriptions FOR SELECT USING (
      user_id = auth.uid()
    );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Manage own push subs') THEN
    CREATE POLICY "Manage own push subs" ON push_subscriptions FOR ALL USING (
      user_id = auth.uid()
    );
  END IF;
END $$;

-- =====================================================
-- audit_logs policies (admin only for reading)
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin read audit logs') THEN
    CREATE POLICY "Admin read audit logs" ON audit_logs FOR SELECT USING (
      EXISTS (SELECT 1 FROM profils WHERE id = auth.uid() AND role = 'admin')
    );
  END IF;
END $$;

-- System can insert audit logs (via service role)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'System insert audit logs') THEN
    CREATE POLICY "System insert audit logs" ON audit_logs FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- =====================================================
-- email_confirmations policies
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'System manage email confirmations') THEN
    CREATE POLICY "System manage email confirmations" ON email_confirmations FOR ALL USING (true);
  END IF;
END $$;

-- =====================================================
-- Vérification: toutes les tables ont RLS activé
-- =====================================================

DO $$ DECLARE
  tbl TEXT;
  missing TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = tbl AND c.relrowsecurity = true
    ) THEN
      missing := array_append(missing, tbl);
    END IF;
  END LOOP;

  IF array_length(missing, 1) > 0 THEN
    RAISE WARNING 'Tables WITHOUT RLS: %', array_to_string(missing, ', ');
  ELSE
    RAISE NOTICE 'All tables have RLS enabled';
  END IF;
END $$;
