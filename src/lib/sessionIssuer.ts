import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { env } from '@/lib/env';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * Ouvre une session Supabase pour un utilisateur dont l'identité vient d'être
 * établie côté serveur (mot de passe + code à usage unique validés).
 *
 * Supabase n'expose pas d'API « crée-moi une session pour cet identifiant ».
 * Le chemin officiel est de générer un jeton de lien magique — `generateLink`
 * ne déclenche aucun envoi d'email, il ne fait que produire le jeton — puis de
 * l'échanger contre une session via `verifyOtp`, ce qui pose les cookies
 * d'authentification sur la réponse.
 *
 * L'alternative aurait été de conserver le mot de passe entre les deux étapes
 * pour rejouer `signInWithPassword` ; garder un mot de passe en clair, même
 * chiffré dans un cookie éphémère, est exactement ce qu'on cherche à éviter.
 */
export async function issueSessionFor(email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });

  if (error || !data?.properties?.hashed_token) {
    console.error('[sessionIssuer] generateLink :', error?.message);
    return { ok: false, error: "Ouverture de session impossible. Réessayez." };
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: data.properties.hashed_token,
    type: 'magiclink',
  });

  if (verifyError) {
    console.error('[sessionIssuer] verifyOtp :', verifyError.message);
    return { ok: false, error: "Ouverture de session impossible. Réessayez." };
  }

  return { ok: true };
}
