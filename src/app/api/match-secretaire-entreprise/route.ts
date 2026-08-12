import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import { rateLimit } from '@/lib/rateLimit';
import { getAuthenticatedUser } from '@/lib/auth';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

const SecretaireSchema = z.object({
  id: z.string(),
  nom: z.string(),
  bio: z.string().nullable().optional(),
  ville: z.string().nullable().optional(),
  disponibilite: z.string().nullable().optional(),
  niveau_etudes: z.string().nullable().optional(),
  specialite: z.string().nullable().optional(),
  langues: z.array(z.string()).nullable().optional(),
  outils: z.array(z.string()).nullable().optional(),
  soft_skills: z.array(z.string()).nullable().optional(),
  competences: z.array(z.string()).nullable().optional(),
  annees_experience: z.number().nullable().optional(),
});

const FiltersSchema = z.object({
  q: z.string().default(''),
  outils: z.array(z.string()).default([]),
  langues: z.array(z.string()).default([]),
  disponibilite: z.string().default(''),
  niveauEtudes: z.string().default(''),
  specialite: z.string().default(''),
  ville: z.string().default(''),
  experienceMin: z.number().default(0),
});

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
  const { allowed, remaining } = rateLimit(`match-entreprise:${ip}`, 10, 60_000);
  if (!allowed) {
    console.warn(`[RATE_LIMIT] match-entreprise IP=${ip}`);
    return NextResponse.json({ error: 'Trop de requêtes. Réessayez dans 1 minute.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const start = Date.now();
    const parsed_body = z.object({
      secretaire: SecretaireSchema,
      filters: FiltersSchema,
    }).safeParse(body);

    if (!parsed_body.success) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }

    const { secretaire, filters } = parsed_body.data;

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'REMPLACER_PAR_VOTRE_CLE_API') {
      return NextResponse.json({ error: 'Clé API Gemini non configurée' }, { status: 500 });
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const prompt = `Tu es un expert en recrutement de secrétaires. Analyse la correspondance entre ce profil de secrétaire et les critères de recherche d'une entreprise.

Profil de la secrétaire :
- Spécialité : ${secretaire.specialite || 'Non renseignée'}
- Bio : ${secretaire.bio || 'Non renseignée'}
- Compétences : ${secretaire.competences?.join(', ') || 'Aucune'}
- Outils maîtrisés : ${secretaire.outils?.join(', ') || 'Aucun'}
- Soft skills : ${secretaire.soft_skills?.join(', ') || 'Aucun'}
- Langues : ${secretaire.langues?.join(', ') || 'Aucune'}
- Ville : ${secretaire.ville || 'Non renseignée'}
- Disponibilité : ${secretaire.disponibilite || 'Non renseignée'}
- Niveau d'études : ${secretaire.niveau_etudes || 'Non renseigné'}
- Expérience : ${secretaire.annees_experience || 0} ans

Filtres de recherche de l'entreprise :
- Spécialité recherchée : ${filters.specialite || 'Indifférent'}
- Recherche libre : ${filters.q || 'Aucune'}
- Outils requis : ${filters.outils.length > 0 ? filters.outils.join(', ') : 'Aucun'}
- Langues requises : ${filters.langues.length > 0 ? filters.langues.join(', ') : 'Aucune'}
- Disponibilité souhaitée : ${filters.disponibilite || 'Indifférent'}
- Niveau d'études minimum : ${filters.niveauEtudes || 'Indifférent'}
- Ville : ${filters.ville || 'Indifférent'}
- Expérience minimum : ${filters.experienceMin} ans

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

    // Extraire le JSON de la réponse (au cas où Gemini ajouterait du texte)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Réponse IA invalide' }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    console.log(`[MATCH_ENTREPRISE] score=${parsed.score} ip=${ip} duration=${Date.now() - start}ms`);

    return NextResponse.json({
      score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
      explication: String(parsed.explication || ''),
      points_forts: Array.isArray(parsed.points_forts) ? parsed.points_forts : [],
      points_a_verifier: Array.isArray(parsed.points_a_verifier) ? parsed.points_a_verifier : [],
    });
  } catch (err) {
    console.error('[MATCH_ENTREPRISE] Erreur:', err);
    return NextResponse.json({ error: 'Erreur IA' }, { status: 500 });
  }
}
