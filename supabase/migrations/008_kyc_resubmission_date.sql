-- =====================================================
-- MIGRATION 008 : date de dernière soumission d'un KYC
-- =====================================================
--
-- Un dossier refusé puis corrigé par l'utilisateur restait affiché avec sa
-- date de création d'origine : l'administrateur voyait « Soumis le … » des
-- semaines plus tôt et le dossier restait au fond de la liste, alors qu'il
-- venait d'être retravaillé.
--
-- `updated_at` ne pouvait pas servir : il est aussi écrasé lors de
-- l'approbation ou du refus par l'administrateur. Une colonne dédiée sépare
-- « dernière soumission par l'utilisateur » de « dernière modification ».

ALTER TABLE kyc_verifications
  ADD COLUMN IF NOT EXISTS derniere_soumission_at TIMESTAMPTZ;

-- Les dossiers existants n'ont connu qu'une soumission : celle de leur création.
UPDATE kyc_verifications
  SET derniere_soumission_at = created_at
  WHERE derniere_soumission_at IS NULL;

ALTER TABLE kyc_verifications
  ALTER COLUMN derniere_soumission_at SET DEFAULT NOW();

-- Tri de la file d'attente administrateur.
CREATE INDEX IF NOT EXISTS idx_kyc_derniere_soumission
  ON kyc_verifications(derniere_soumission_at DESC);
