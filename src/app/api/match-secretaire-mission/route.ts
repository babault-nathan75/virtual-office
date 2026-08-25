import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { rateLimit } from '@/lib/rateLimit';
import { getAuthenticatedUser } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');


const MissionSchema = z.object({
  id: z.number(),
  titre: z.string(),
  description: z.string(),
  date_debut: z.string().nullable().optional(),
  date_fin: z.string().nullable().optional(),
});

const BodySchema = z.object({
  secretaireId: z.string().uuid(),
  mission: MissionSchema,
});

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
  const { allowed } = rateLimit(`match-mission:${ip}`, 10, 60_000);
  if (!allowed) {
    console.warn(`[RATE_LIMIT] match-mission IP=${ip}`);
    return NextResponse.json({ error: 'Trop de requêtes. Réessayez dans 1 minute.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const start = Date.now();
    const parsed_body = BodySchema.safeParse(body);

    if (!parsed_body.success) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }

    const { secretaireId, mission } = parsed_body.data;

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'REMPLACER_PAR_VOTRE_CLE_API') {
      return NextResponse.json({ error: 'Clé API Gemini non configurée' }, { status: 500 });
    }

    // Récupérer le profil de la secrétaire
    const { data: profil } = await getSupabaseAdmin()
      .from('profils_secretaires')
      .select('bio, competences, outils, soft_skills, langues, ville, disponibilite, niveau_etudes, specialite, annees_experience')
      .eq('id', secretaireId)
      .single();

    if (!profil) {
      return NextResponse.json({ error: 'Profil secrétaire introuvable' }, { status: 404 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `Tu es un expert en recrutement. Évalue la compatibilité entre cette secrétaire et la mission suivante.

Profil de la secrétaire :
- Spécialité : ${profil.specialite || 'Non renseignée'}
- Bio : ${profil.bio || 'Non renseignée'}
- Compétences : ${profil.competences?.join(', ') || 'Aucune'}
- Outils maîtrisés : ${profil.outils?.join(', ') || 'Aucun'}
- Soft skills : ${profil.soft_skills?.join(', ') || 'Aucun'}
- Langues : ${profil.langues?.join(', ') || 'Aucune'}
- Ville : ${profil.ville || 'Non renseignée'}
- Disponibilité : ${profil.disponibilite || 'Non renseignée'}
- Niveau d'études : ${profil.niveau_etudes || 'Non renseigné'}
- Expérience : ${profil.annees_experience || 0} ans

Mission :
- Titre : ${mission.titre}
- Description : ${mission.description}
- Date de début : ${mission.date_debut || 'Non définie'}
- Date de fin : ${mission.date_fin || 'Non définie'}

Retourne UNIQUEMENT un JSON valide (pas de texte avant ou après) avec cette structure :
{
  "score": nombre entier de 0 à 100,
  "explication": "phrase courte expliquant le score",
  "points_forts": ["point fort 1", "point fort 2"],
  "points_a_verifier": ["point à vérifier 1"]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Réponse IA invalide' }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    console.log(`[MATCH_MISSION] score=${parsed.score} mission=${mission.titre} ip=${ip} duration=${Date.now() - start}ms`);

    return NextResponse.json({
      score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
      explication: String(parsed.explication || ''),
      points_forts: Array.isArray(parsed.points_forts) ? parsed.points_forts : [],
      points_a_verifier: Array.isArray(parsed.points_a_verifier) ? parsed.points_a_verifier : [],
    });
  } catch (err) {
    console.error('[MATCH_MISSION] Erreur:', err);
    return NextResponse.json({ error: 'Erreur IA' }, { status: 500 });
  }
}
