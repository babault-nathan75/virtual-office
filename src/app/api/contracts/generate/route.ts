import { NextResponse } from 'next/server';
import { escapeHtml } from '@/lib/sanitize';
import { getAuthenticatedUser } from '@/lib/auth';
import { z } from 'zod';
import { checkRateLimit, getClientIp } from '@/lib/rateLimit';
import { formatDateLong } from '@/lib/i18n';

const contractSchema = z.object({
  entrepriseNom: z.string().min(1).max(200),
  secretaireNom: z.string().min(1).max(200),
  missionTitre: z.string().min(1).max(200),
  missionDescription: z.string().max(2000),
  dateDebut: z.string().min(1),
  dateFin: z.string().min(1),
  tarif: z.string().max(100),
  conditions: z.string().max(2000).optional(),
});

type ContractData = {
  entrepriseNom: string;
  secretaireNom: string;
  missionTitre: string;
  missionDescription: string;
  dateDebut: string;
  dateFin: string;
  tarif: string;
  conditions?: string;
};

function generateContractHTML(data: ContractData): string {
  const e = {
    entrepriseNom: escapeHtml(data.entrepriseNom),
    secretaireNom: escapeHtml(data.secretaireNom),
    missionTitre: escapeHtml(data.missionTitre),
    missionDescription: escapeHtml(data.missionDescription),
    dateDebut: escapeHtml(data.dateDebut),
    dateFin: escapeHtml(data.dateFin),
    tarif: escapeHtml(data.tarif),
    conditions: escapeHtml(data.conditions || ''),
  };
  return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Contrat - ${e.missionTitre}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #1e293b; line-height: 1.6; }
    .header { text-align: center; border-bottom: 3px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { color: #2563eb; font-size: 24px; margin: 0; }
    .header p { color: #64748b; font-size: 12px; margin-top: 5px; }
    .section { margin-bottom: 24px; }
    .section h2 { color: #2563eb; font-size: 16px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
    .field { margin-bottom: 12px; }
    .field label { font-weight: 700; font-size: 12px; text-transform: uppercase; color: #64748b; display: block; margin-bottom: 4px; }
    .field p { margin: 0; font-size: 14px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; }
    .signature-box { border-top: 2px solid #1e293b; padding-top: 10px; text-align: center; }
    .signature-box p { font-size: 12px; color: #64748b; }
    .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 20px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>CONTRAT DE PRESTATION DE SERVICES</h1>
    <p>SecrétariatPro — Plateforme de mise en relation</p>
    <p>Référence : ${Date.now().toString(36).toUpperCase()}</p>
  </div>

  <div class="section">
    <h2>1. Parties</h2>
    <div class="field">
      <label>Client (Entreprise)</label>
      <p>${e.entrepriseNom}</p>
    </div>
    <div class="field">
      <label>Prestataire (Secrétaire)</label>
      <p>${e.secretaireNom}</p>
    </div>
  </div>

  <div class="section">
    <h2>2. Objet du contrat</h2>
    <div class="field">
      <label>Mission</label>
      <p>${e.missionTitre}</p>
    </div>
    <div class="field">
      <label>Description</label>
      <p>${e.missionDescription}</p>
    </div>
  </div>

  <div class="section">
    <h2>3. Durée</h2>
    <div class="field">
      <label>Date de début</label>
      <p>${e.dateDebut}</p>
    </div>
    <div class="field">
      <label>Date de fin</label>
      <p>${e.dateFin}</p>
    </div>
  </div>

  <div class="section">
    <h2>4. Rémunération</h2>
    <div class="field">
      <label>Tarif convenu</label>
      <p>${e.tarif}</p>
    </div>
  </div>

  <div class="section">
    <h2>5. Conditions</h2>
    <div class="field">
      <p>${e.conditions || 'Les parties s\'engagent à respecter les termes du présent contrat. Tout manquement pourra donner lieu à résiliation.'}</p>
    </div>
  </div>

  <div class="section">
    <h2>6. Confidentialité</h2>
    <p style="font-size: 13px;">Le prestataire s\'engage à respecter la confidentialité de toutes les informations auxquelles il aura accès dans le cadre de cette mission.</p>
  </div>

  <div class="signatures">
    <div class="signature-box">
      <p style="height: 60px;"></p>
      <p><strong>${e.entrepriseNom}</strong></p>
      <p>Client</p>
    </div>
    <div class="signature-box">
      <p style="height: 60px;"></p>
      <p><strong>${e.secretaireNom}</strong></p>
      <p>Prestataire</p>
    </div>
  </div>

  <div class="footer">
    <p>Document généré par SecrétariatPro — ${formatDateLong(Date.now())}</p>
    <p>Ce contrat est généré automatiquement. Les parties peuvent y apposer leur signature manuscrite ou électronique.</p>
  </div>
</body>
</html>`;
}

export async function POST(request: Request) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const rateLimitResult = await checkRateLimit(`contracts:${getClientIp(request)}`, 5, 60000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: 'Trop de requêtes.' }, { status: 429 });
    }

    const body = await request.json();
    const parsed = contractSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides' }, { status: 400 });
    }

    const data = parsed.data;
    const html = generateContractHTML(data);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="contrat-${data.missionTitre.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase()}.html"`,
      },
    });
  } catch {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
