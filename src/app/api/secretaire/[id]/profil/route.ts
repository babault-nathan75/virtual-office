import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getAuthenticatedUser } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * Fiche détaillée d'une secrétaire, consultée depuis la modale « Voir le
 * profil » du tableau de bord entreprise.
 *
 * Cette route était appelée par le client mais n'existait pas : la modale
 * échouait systématiquement sur « Erreur chargement profil ».
 */

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const paramsSchema = z.object({ id: z.string().uuid() });

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const { allowed } = await checkRateLimit(`secretaire-profil:${user.id}`, 60, 60000);
  if (!allowed) {
    return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
  }

  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Identifiant invalide' }, { status: 400 });
  }
  const secretaireId = parsed.data.id;

  // Seules les entreprises et les administrateurs consultent ces fiches ;
  // une secrétaire peut consulter la sienne.
  const { data: callerProfile } = await supabaseAdmin
    .from('profils')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = callerProfile?.role;
  const isSelf = user.id === secretaireId;
  if (role !== 'entreprise' && role !== 'admin' && !isSelf) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });
  }

  const { data: cible } = await supabaseAdmin
    .from('profils')
    .select('id, nom, role')
    .eq('id', secretaireId)
    .maybeSingle();

  if (!cible || cible.role !== 'secretaire') {
    return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
  }

  // Un profil non vérifié n'est pas exposé aux entreprises : c'est la règle
  // annoncée aux secrétaires lors de la soumission du KYC.
  if (!isSelf && role !== 'admin') {
    const { data: kyc } = await supabaseAdmin
      .from('kyc_verifications')
      .select('statut')
      .eq('user_id', secretaireId)
      .maybeSingle();

    if (kyc?.statut !== 'approved') {
      return NextResponse.json({ error: 'Profil non vérifié' }, { status: 403 });
    }
  }

  // Chaîne littérale (et non concaténée) : le client Supabase en dérive le
  // type du résultat, ce qu'une concaténation lui interdit.
  const { data: profil, error } = await supabaseAdmin
    .from('profils_secretaires')
    .select('id, photo_url, bio, ville, disponibilite, niveau_etudes, specialite, langues, outils, soft_skills, competences, annees_experience')
    .eq('id', secretaireId)
    .maybeSingle();

  if (error) {
    console.error('[secretaire/profil] Erreur:', error.message);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }

  if (!profil) {
    return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 });
  }

  return NextResponse.json({ ...(profil as Record<string, unknown>), nom: cible.nom });
}
