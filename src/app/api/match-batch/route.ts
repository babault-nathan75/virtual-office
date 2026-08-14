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
  ville: z.string().default(''),
  experienceMin: z.number().default(0),
});

const BodySchema = z.object({
  secretaires: z.array(SecretaireSchema).max(10),
  filters: FiltersSchema,
});

function buildPrompt(secretaires: z.infer<typeof SecretaireSchema>[], filters: z.infer<typeof FiltersSchema>) {
  const profiles = secretaires.map((s, i) => `
Profil ${i + 1} (ID: ${s.id}) :
- Nom: ${s.nom}
- Bio: ${s.bio || 'Non renseignée'}
- Compétences: ${s.competences?.join(', ') || 'Aucune'}
- Outils: ${s.outils?.join(', ') || 'Aucun'}
- Soft skills: ${s.soft_skills?.join(', ') || 'Aucun'}
- Langues: ${s.langues?.join(', ') || 'Aucune'}
- Ville: ${s.ville || 'Non renseignée'}
- Disponibilité: ${s.disponibilite || 'Non renseignée'}
- Niveau d'études: ${s.niveau_etudes || 'Non renseigné'}
- Expérience: ${s.annees_experience || 0} ans
`).join('\n');

  return `Tu es un expert en recrutement de secrétaires. Analyse la correspondance entre CHAQUE profil de secrétaire et les critères de recherche d'une entreprise.

Filtres de recherche :
- Recherche libre : ${filters.q || 'Aucune'}
- Outils requis : ${filters.outils.length > 0 ? filters.outils.join(', ') : 'Aucun'}
- Langues requises : ${filters.langues.length > 0 ? filters.langues.join(', ') : 'Aucune'}
- Disponibilité souhaitée : ${filters.disponibilite || 'Indifférent'}
- Niveau d'études minimum : ${filters.niveauEtudes || 'Indifférent'}
- Ville : ${filters.ville || 'Indifférent'}
- Expérience minimum : ${filters.experienceMin} ans

Profils à analyser :
${profiles}

Retourne UNIQUEMENT un JSON valide (pas de texte avant ou après) avec cette structure :
{
  "results": [
    {
      "id": "ID du profil",
      "score": nombre entier de 0 à 100,
      "explication": "phrase courte expliquant le score",
      "points_forts": ["point fort 1", "point fort 2"],
      "points_a_verifier": ["point à vérifier 1"]
    }
  ]
}`;
}

export async function POST(req: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
  const { allowed } = rateLimit(`match-batch:${ip}`, 5, 60_000);
  if (!allowed) {
    console.warn(`[RATE_LIMIT] match-batch IP=${ip}`);
    return NextResponse.json({ error: 'Trop de requêtes. Réessayez dans 1 minute.' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const start = Date.now();
    const parsed_body = BodySchema.safeParse(body);

    if (!parsed_body.success) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === 'REMPLACER_PAR_VOTRE_CLE_API') {
      return NextResponse.json({ error: 'Clé API Gemini non configurée' }, { status: 500 });
    }

    const { secretaires, filters } = parsed_body.data;
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = buildPrompt(secretaires, filters);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Réponse IA invalide' }, { status: 500 });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const results: Record<string, unknown> = {};

    if (Array.isArray(parsed.results)) {
      for (const r of parsed.results) {
        if (r.id) {
          results[r.id] = {
            score: Math.min(100, Math.max(0, Number(r.score) || 0)),
            explication: String(r.explication || ''),
            points_forts: Array.isArray(r.points_forts) ? r.points_forts : [],
            points_a_verifier: Array.isArray(r.points_a_verifier) ? r.points_a_verifier : [],
          };
        }
      }
    }

    console.log(`[MATCH_BATCH] profiles=${secretaires.length} ip=${ip} duration=${Date.now() - start}ms`);

    return NextResponse.json({ results });
  } catch (err) {
    console.error('[MATCH_BATCH] Erreur:', err);
    return NextResponse.json({ error: 'Erreur IA' }, { status: 500 });
  }
}
