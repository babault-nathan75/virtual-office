import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { createClient } from '@supabase/supabase-js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

async function fileToGenerativePart(file: File) {
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString('base64');
  return {
    inlineData: {
      mimeType: file.type || 'image/jpeg',
      data: base64,
    },
  };
}

type FieldResult = {
  match: boolean;
  score: number;
  extracted: string;
  provided: string;
  explanation: string;
  suggestion: string | null;
};

type VerifyResult = {
  faceMatch: {
    score: number;
    isMatch: boolean;
    explanation: string;
  };
  ocr: {
    prenoms: string[];
    nom: string;
    date_naissance: string;
    nationalite: string;
    numero_document: string;
  };
  fieldComparison: {
    prenom: FieldResult;
    nom: FieldResult;
    date_naissance: FieldResult;
    nationalite: FieldResult;
  };
  overallScore: number;
  overallExplanation: string;
  recommendations: string[];
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const pieceIdentite = formData.get('piece_identite') as File | null;
    const selfie = formData.get('selfie') as File | null;
    const prenom = formData.get('prenom') as string || '';
    const nomNaissance = formData.get('nom_naissance') as string || '';
    const dateNaissance = formData.get('date_naissance') as string || '';
    const nationalite = formData.get('nationalite') as string || '';

    if (!pieceIdentite || !selfie) {
      return NextResponse.json(
        { error: 'Pièce d\'identité et selfie requis' },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const idPart = await fileToGenerativePart(pieceIdentite);
    const selfiePart = await fileToGenerativePart(selfie);

    const prompt = `Tu es un expert en vérification d'identité KYC.

ANALYSE CES DEUX IMAGES :
1. Image 1 : Pièce d'identité (carte, passeport ou permis)
2. Image 2 : Selfie de vérification

FORMULAIRE UTILISATEUR :
- Prénom(s) : "${prenom}"
- Nom de naissance : "${nomNaissance}"
- Date de naissance : "${dateNaissance}"
- Nationalité : "${nationalite}"

IMPORTANT sur les prénoms :
- L'utilisateur peut avoir 1 ou PLUSIEURS prénoms
- Sur la pièce d'identité, les prénoms peuvent apparaître dans un ordre différent
- Exemple : "Marie Claire" sur le formulaire peut correspondre à "Claire Marie" sur la pièce
- Un prénom peut aussi être un diminutif (ex: "Bob" vs "Robert")
- Extrais TOUS les prénoms visibles sur la pièce d'identité

MISSION :
1. EXTRAIRE les informations de la pièce d'identité (OCR)
2. COMPARER le visage du selfie avec la photo de la pièce
3. COMPARER CHAQUE champ du formulaire avec ce qui est extrait
4. Pour chaque champ, donner un SCORE de 0 à 100 et une suggestion de correction si nécessaire

RÉPONSE JSON UNIQUE (pas de markdown) :
{
  "faceMatch": {
    "score": 0-100,
    "isMatch": true/false,
    "explanation": "Description précise de la ressemblance"
  },
  "ocr": {
    "prenoms": ["prénom1", "prénom2"],
    "nom": "nom de naissance",
    "date_naissance": "JJ/MM/AAAA ou tel que visible",
    "nationalite": "nationalité",
    "numero_document": "numéro si visible"
  },
  "fieldComparison": {
    "prenom": {
      "match": true/false,
      "score": 0-100,
      "extracted": "prénoms extraits de la pièce",
      "provided": "prénoms du formulaire",
      "explanation": "Explique EXACTEMENT ce qui ne matche pas. Ex: 'Le formulaire indique Marie Claire mais la pièce indique Claire Marie. Les prénoms sont inversés.' ou 'Le formulaire indique Bob mais la pièce indique Robert. Il s agit d un diminutif.'",
      "suggestion": "La correction à apporter, ou null si c'est bon"
    },
    "nom": {
      "match": true/false,
      "score": 0-100,
      "extracted": "nom extrait",
      "provided": "nom du formulaire",
      "explanation": "Explique l'écart s'il y en a un",
      "suggestion": "La correction à apporter, ou null si c'est bon"
    },
    "date_naissance": {
      "match": true/false,
      "score": 0-100,
      "extracted": "date extraite",
      "provided": "date du formulaire",
      "explanation": "Explique l'écart s'il y en a un",
      "suggestion": "La correction à apporter, ou null si c'est bon"
    },
    "nationalite": {
      "match": true/false,
      "score": 0-100,
      "extracted": "nationalité extraite",
      "provided": "nationalité du formulaire",
      "explanation": "Explique l'écart s'il y en a un",
      "suggestion": "La correction à apporter, ou null si c'est bon"
    }
  },
  "overallScore": 0-100,
  "overallExplanation": "Résumé clair et précis",
  "recommendations": ["Action concrète pour l'utilisateur"]
}`;

    const result = await model.generateContent([
      { text: prompt },
      idPart,
      selfiePart,
    ]);

    const response = await result.response;
    const text = response.text();

    let parsed: VerifyResult;
    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: 'Erreur lors de l\'analyse IA', raw: text },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin();
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action: 'kyc_verify',
          details: JSON.stringify({ overallScore: parsed.overallScore }),
          created_at: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('[kyc/verify] error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur lors de la vérification' },
      { status: 500 }
    );
  }
}
