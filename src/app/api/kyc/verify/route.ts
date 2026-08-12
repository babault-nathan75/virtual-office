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

type VerifyResult = {
  faceMatch: {
    score: number;
    isMatch: boolean;
    explanation: string;
  };
  ocr: {
    prenom: string;
    nom: string;
    date_naissance: string;
    nationalite: string;
    numero_document: string;
  };
  fieldComparison: {
    prenom: { match: boolean; extracted: string; provided: string; explanation: string };
    nom: { match: boolean; extracted: string; provided: string; explanation: string };
    date_naissance: { match: boolean; extracted: string; provided: string; explanation: string };
    nationalite: { match: boolean; extracted: string; provided: string; explanation: string };
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

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const idPart = await fileToGenerativePart(pieceIdentite);
    const selfiePart = await fileToGenerativePart(selfie);

    const prompt = `Tu es un expert en vérification d'identité et KYC (Know Your Customer).

Analyse ces deux images :
1. Image 1 : Pièce d'identité (carte nationale, passeport ou permis)
2. Image 2 : Selfie de vérification

FORMULAIRE REMPLI PAR L'UTILISATEUR :
- Prénom : "${prenom}"
- Nom de naissance : "${nomNaissance}"
- Date de naissance : "${dateNaissance}"
- Nationalité : "${nationalite}"

MISSION :
1. EXTRAIRE les informations de la pièce d'identité (OCR)
2. COMPARER le visage du selfie avec la photo de la pièce d'identité
3. COMPARER les informations extraites avec celles du formulaire
4. Donner un score de confiance global

Réponds UNIQUEMENT avec un JSON valide (pas de markdown, pas de commentaires) :
{
  "faceMatch": {
    "score": 0-100,
    "isMatch": true/false,
    "explanation": "Explication précise de la comparaison des visages"
  },
  "ocr": {
    "prenom": "prénom extrait de la pièce",
    "nom": "nom extrait de la pièce",
    "date_naissance": "date extraite",
    "nationalite": "nationalité extraite",
    "numero_document": "numéro du document si visible"
  },
  "fieldComparison": {
    "prenom": {
      "match": true/false,
      "extracted": "valeur extraite",
      "provided": "valeur du formulaire",
      "explanation": "Explication précise de la comparaison"
    },
    "nom": {
      "match": true/false,
      "extracted": "valeur extraite",
      "provided": "valeur du formulaire",
      "explanation": "Explication précise"
    },
    "date_naissance": {
      "match": true/false,
      "extracted": "valeur extraite",
      "provided": "valeur du formulaire",
      "explanation": "Explication précise"
    },
    "nationalite": {
      "match": true/false,
      "extracted": "valeur extraite",
      "provided": "valeur du formulaire",
      "explanation": "Explication précise"
    }
  },
  "overallScore": 0-100,
  "overallExplanation": "Résumé global de la vérification",
  "recommendations": ["liste des recommandations"]
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
