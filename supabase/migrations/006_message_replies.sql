-- =====================================================
-- MIGRATION 006 : réponse à un message (reply_to)
-- =====================================================
--
-- L'interface de discussion proposait déjà de « répondre » à un message
-- (bannière de citation, placeholder dédié), mais la référence n'était
-- persistée nulle part : le destinataire ne voyait jamais à quoi on répondait.

-- `messages.id` est de type UUID. Une première version de cette migration
-- déclarait `reply_to` en BIGINT : la colonne était créée, puis la contrainte
-- de clé étrangère échouait (« incompatible types: bigint and uuid »). On
-- repart donc d'une colonne propre si le mauvais type a été appliqué.
DO $$
DECLARE
  type_actuel text;
BEGIN
  SELECT data_type INTO type_actuel
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'messages'
    AND column_name = 'reply_to';

  IF type_actuel IS NOT NULL AND type_actuel <> 'uuid' THEN
    ALTER TABLE messages DROP COLUMN reply_to;
  END IF;
END $$;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to UUID;

-- ON DELETE SET NULL : la suppression d'un message cité ne doit pas emporter
-- les réponses qui s'y rattachent.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_reply_to_fkey'
  ) THEN
    ALTER TABLE messages
      ADD CONSTRAINT messages_reply_to_fkey
      FOREIGN KEY (reply_to) REFERENCES messages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Sert à retrouver les réponses d'un message donné.
CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to) WHERE reply_to IS NOT NULL;
