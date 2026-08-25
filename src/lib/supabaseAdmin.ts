import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

/**
 * Client Supabase en service role, partagé par toutes les routes serveur.
 *
 * Il était jusqu'ici recréé à l'identique dans une quinzaine de fichiers, ce
 * qui multipliait les connexions et laissait `persistSession` à sa valeur par
 * défaut — un client service role ne doit jamais tenter de persister ou de
 * rafraîchir une session.
 *
 * L'instanciation est paresseuse : importer ce module depuis un contexte sans
 * clé service role (build, test) ne doit pas lever.
 */
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (!cached) {
    cached = createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { 'X-Client-Info': 'secretariatpro-server' } },
    });
  }
  return cached;
}
