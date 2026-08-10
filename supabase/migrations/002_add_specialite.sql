-- Ajout de la colonne specialite à la table profils_secretaires
ALTER TABLE profils_secretaires ADD COLUMN IF NOT EXISTS specialite text;

-- Index pour les recherches par spécialité
CREATE INDEX IF NOT EXISTS idx_profils_secretaires_specialite ON profils_secretaires (specialite) WHERE specialite IS NOT NULL;
