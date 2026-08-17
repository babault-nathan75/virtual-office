-- =====================================================
-- MIGRATION 007 : confidentialité de la table profils
-- =====================================================
--
-- La policy « Public read profils ... USING (true) » n'avait aucune clause TO :
-- elle s'appliquait donc aussi au rôle `anon`. Comme la clé anon est publique
-- (présente dans le bundle client), n'importe qui pouvait récupérer l'annuaire
-- complet — noms, emails, téléphones, rôles — sans posséder de compte.
--
-- Règle retenue : les coordonnées (email, téléphone) ne sont accessibles qu'à
-- leur propriétaire et aux administrateurs. Les autres utilisateurs ne voient
-- que l'identité publique (id, nom, rôle), via la vue `profils_publics`.

-- -----------------------------------------------------
-- 1. Test « est admin » sans récursion
-- -----------------------------------------------------
--
-- Les policies existantes testaient le rôle admin par
-- « EXISTS (SELECT 1 FROM profils WHERE id = auth.uid() AND role = 'admin') ».
-- Interroger `profils` depuis une policy portant sur `profils` déclenche la
-- réévaluation de cette même policy : PostgreSQL lève alors
-- « infinite recursion detected in policy for relation profils ».
-- Une fonction SECURITY DEFINER contourne la RLS et coupe la récursion.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profils WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- -----------------------------------------------------
-- 2. Nouvelles policies de lecture sur profils
-- -----------------------------------------------------

DROP POLICY IF EXISTS "Public read profils" ON profils;
DROP POLICY IF EXISTS "Admin full access profils" ON profils;

-- Chacun lit sa propre fiche, en entier.
DROP POLICY IF EXISTS "Read own profil" ON profils;
CREATE POLICY "Read own profil" ON profils
  FOR SELECT USING (id = auth.uid());

-- Les administrateurs conservent un accès complet (lecture et écriture).
DROP POLICY IF EXISTS "Admin manage profils" ON profils;
CREATE POLICY "Admin manage profils" ON profils
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- `anon` n'a plus aucune raison de lire cette table : la RLS ci-dessus ne lui
-- accorde aucune ligne (auth.uid() est NULL), mais on retire aussi le droit
-- au niveau des privilèges, par défense en profondeur.
REVOKE ALL ON TABLE profils FROM anon;

-- -----------------------------------------------------
-- 3. Identité publique, sans coordonnées
-- -----------------------------------------------------
--
-- Recherche, mentions, listes de contacts et libellés de notifications n'ont
-- besoin que de l'identité. Cette vue l'expose sans email ni téléphone.
CREATE OR REPLACE VIEW public.profils_publics AS
  SELECT id, nom, role, created_at
  FROM public.profils;

-- security_invoker = off : la vue est évaluée avec les droits de son
-- propriétaire et contourne donc la RLS de `profils`. C'est voulu — c'est la
-- sélection de colonnes ci-dessus qui joue le rôle de garde-fou.
ALTER VIEW public.profils_publics SET (security_invoker = off);

REVOKE ALL ON public.profils_publics FROM anon;
GRANT SELECT ON public.profils_publics TO authenticated;

-- -----------------------------------------------------
-- 4. Fiches professionnelles des secrétaires
-- -----------------------------------------------------
--
-- Même défaut que pour `profils` : la policy « Public read secretary
-- profiles ... USING (true) » n'avait pas de clause TO. Biographies, photos,
-- villes et parcours — des données personnelles rattachées à des personnes
-- identifiées — étaient donc consultables sans compte.
--
-- Ces fiches doivent rester visibles des entreprises : on exige simplement
-- d'être authentifié. Toutes les pages qui les consultent (recherche,
-- rapprochement, tableaux de bord) sont derrière une authentification.
DROP POLICY IF EXISTS "Public read secretary profiles" ON profils_secretaires;

DROP POLICY IF EXISTS "Read secretary profiles" ON profils_secretaires;
CREATE POLICY "Read secretary profiles" ON profils_secretaires
  FOR SELECT TO authenticated USING (true);

REVOKE ALL ON TABLE profils_secretaires FROM anon;
