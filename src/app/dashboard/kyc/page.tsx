'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from '@/components/Link';
import { toast } from '@/components/Toast';
import { Button, Card, Breadcrumbs } from '@/components/ui';
import { PhotoCapture } from '@/components/PhotoCapture';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

type FormData = {
  prenom: string;
  nom_naissance: string;
  date_naissance: string;
  nationalite: string;
  nom_entreprise: string;
};

type FieldExplanation = {
  label: string;
  description: string;
  icon: string;
  required: boolean;
};

const FIELD_EXPLANATIONS: FieldExplanation[] = [
  {
    label: 'Prénom',
    description: 'Le(s) prénom(s) tel(s) qu\'il(s) apparaît(ent) sur votre pièce d\'identité officielle. Il doit correspondre exactement au document fourni. Les accents et caractères spéciaux sont importants.',
    icon: '👤',
    required: true,
  },
  {
    label: 'Nom de naissance',
    description: 'Votre nom de famille tel qu\'il figure sur votre acte de naissance et votre pièce d\'identité. Si vous avez un nom composé, saisissez-le dans son intégralité (ex: "Kouassi-Mensah").',
    icon: '📋',
    required: true,
  },
  {
    label: 'Date de naissance',
    description: 'Votre date de naissance au format jour/mois/année. Elle doit correspondre exactement à celle de votre pièce d\'identité. Cette information est cruciale pour la vérification d\'identité.',
    icon: '📅',
    required: true,
  },
  {
    label: 'Nationalité',
    description: 'Votre nationalité actuelle telle que mentionnée sur votre pièce d\'identité. Si vous avez plusieurs nationalités, indiquez celle qui apparaît sur votre document officiel.',
    icon: '🌍',
    required: false,
  },
  {
    label: 'Nom de l\'entreprise',
    description: 'La raison sociale officielle de votre entreprise telle qu\'elle figure sur votre K-bis ou registre du commerce. Cette information est vérifiée lors de la validation KYC.',
    icon: '🏢',
    required: false,
  },
];

type FieldResult = {
  match: boolean;
  score: number;
  extracted: string;
  provided: string;
  explanation: string;
  suggestion: string | null;
};

type VerificationResult = {
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

type ExistingKyc = {
  statut: string;
  motif_rejet: string | null;
  verification_score: number | null;
  verification_details: string | null;
} | null;

export default function KycPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'entreprise' | 'secretaire'>('entreprise');
  const [existingKyc, setExistingKyc] = useState<ExistingKyc>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [autoSubmitted, setAutoSubmitted] = useState(false);

  const [form, setForm] = useState<FormData>({
    prenom: '',
    nom_naissance: '',
    date_naissance: '',
    nationalite: '',
    nom_entreprise: '',
  });

  const [pieceIdentite, setPieceIdentite] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [docEntreprise, setDocEntreprise] = useState<File | null>(null);
  const [piecePreview, setPiecePreview] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);

  useDocumentTitle('Vérification d\'identité');

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/connexion'); return; }

      setUserId(session.user.id);

      const { data: profil } = await supabase
        .from('profils')
        .select('role, nom')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profil) {
        setRole(profil.role as 'entreprise' | 'secretaire');
        setForm(prev => ({ ...prev, prenom: profil.nom || '' }));
      }

      const { data: kyc } = await supabase
        .from('kyc_verifications')
        .select('statut, motif_rejet, verification_score, verification_details')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (kyc) setExistingKyc(kyc as ExistingKyc);

      setLoading(false);
    };
    fetchData();
  }, [router]);

  const updateForm = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setVerificationResult(null);
    setAutoSubmitted(false);
  };

  const submitKyc = useCallback(async (result: VerificationResult) => {
    if (!userId || autoSubmitted) return;

    setSubmitting(true);
    try {
      const uploadFile = async (file: File, bucket: string): Promise<string | null> => {
        const ext = file.name.split('.').pop();
        const path = `${userId}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file, {
          contentType: file.type,
          upsert: true,
        });
        if (error) return null;
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data.publicUrl;
      };

      const identiteUrl = pieceIdentite ? await uploadFile(pieceIdentite, 'kyc-identite') : null;
      const selfieUrl = selfie ? await uploadFile(selfie, 'kyc-selfies') : null;
      let docEntrepriseUrl = null;
      if (role === 'entreprise' && docEntreprise) {
        docEntrepriseUrl = await uploadFile(docEntreprise, 'kyc-entreprises');
      }

      const kycData = {
        user_id: userId,
        statut: 'pending',
        prenom: form.prenom.trim(),
        nom_naissance: form.nom_naissance.trim(),
        date_naissance: form.date_naissance,
        nationalite: form.nationalite.trim() || null,
        type_compte: role,
        piece_identite_url: identiteUrl,
        selfie_url: selfieUrl,
        document_entreprise_url: docEntrepriseUrl,
        nom_entreprise: role === 'entreprise' ? form.nom_entreprise.trim() || null : null,
        verification_score: result.overallScore,
        verification_details: JSON.stringify(result),
        motif_rejet: null,
      };

      const { error } = await supabase
        .from('kyc_verifications')
        .upsert(kycData, { onConflict: 'user_id' });

      if (error) throw error;

      setAutoSubmitted(true);
      setExistingKyc({ statut: 'pending', motif_rejet: null, verification_score: result.overallScore, verification_details: JSON.stringify(result) });
      toast.success('KYC soumis automatiquement aux administrateurs pour validation.');
    } catch {
      toast.error('Erreur lors de la soumission du KYC');
    } finally {
      setSubmitting(false);
    }
  }, [userId, role, form, pieceIdentite, selfie, docEntreprise, autoSubmitted]);

  const runVerification = useCallback(async () => {
    if (!pieceIdentite || !selfie) return;

    setVerifying(true);
    try {
      const fd = new FormData();
      fd.append('piece_identite', pieceIdentite);
      fd.append('selfie', selfie);
      fd.append('prenom', form.prenom);
      fd.append('nom_naissance', form.nom_naissance);
      fd.append('date_naissance', form.date_naissance);
      fd.append('nationalite', form.nationalite);

      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/kyc/verify', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session?.access_token}` },
        body: fd,
      });

      if (!res.ok) throw new Error('Erreur de vérification');

      const result: VerificationResult = await res.json();
      setVerificationResult(result);

      if (result.overallScore >= 80) {
        toast.success(`Vérification réussie ! Score : ${result.overallScore}/100. Soumission automatique...`);
        await submitKyc(result);
      } else if (result.overallScore >= 50) {
        toast.warning(`Vérification partielle. Score : ${result.overallScore}/100. Corrigez puis soumettez manuellement.`);
      } else {
        toast.error(`Vérification échouée. Score : ${result.overallScore}/100. Reprenez les photos.`);
      }
    } catch {
      toast.error('Erreur lors de la vérification IA');
    } finally {
      setVerifying(false);
    }
  }, [pieceIdentite, selfie, form, submitKyc]);

  useEffect(() => {
    if (pieceIdentite && selfie && form.prenom && form.nom_naissance && form.date_naissance && !autoSubmitted) {
      runVerification();
    }
  }, [pieceIdentite, selfie, form.prenom, form.nom_naissance, form.date_naissance, form.nationalite, runVerification, autoSubmitted]);

  const handleManualSubmit = async () => {
    if (!verificationResult) return;
    await submitKyc(verificationResult);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // KYC en attente
  if (existingKyc?.statut === 'pending' && !autoSubmitted) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans antialiased">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] p-8 text-center">
          <div className="text-5xl mb-4">⏳</div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-2">
            Vérification en cours
          </h1>
          <p className="text-slate-500 font-medium text-sm mb-4">
            Votre dossier KYC est en cours de vérification par notre équipe.
          </p>
          {existingKyc.verification_score != null && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4">
              <p className="text-xs text-blue-700 font-bold">
                Score IA : {existingKyc.verification_score}/100
              </p>
            </div>
          )}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
            <p className="text-xs text-amber-800 font-bold">
              Délai estimé : 24-48 heures ouvrées
            </p>
          </div>
          <Link
            href="/dashboard"
            className="block w-full py-3.5 rounded-full bg-slate-200 text-slate-700 font-bold hover:bg-slate-300 transition text-sm"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  // KYC rejeté — motif affiché + possibilité de resoumettre
  if (existingKyc?.statut === 'rejected' && !autoSubmitted) {
    return (
      <main className="min-h-screen bg-slate-50 py-12 px-4 font-sans antialiased">
        <div className="max-w-2xl mx-auto">
          <Breadcrumbs items={[
            { label: 'Tableau de bord', href: '/dashboard' },
            { label: 'KYC' },
          ]} />

          <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] overflow-hidden">
            <div className="bg-red-600 p-6 text-white text-center">
              <h1 className="text-2xl font-black tracking-tight">Vérification refusée</h1>
              <p className="text-red-200 text-sm font-medium mt-1">
                Un problème a été détecté sur votre dossier
              </p>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              {/* Motif de rejet */}
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5">
                <h3 className="text-sm font-black text-red-700 mb-2 flex items-center gap-2">
                  <span className="text-lg">⚠️</span> Raison du refus
                </h3>
                <p className="text-sm text-red-800 leading-relaxed">
                  {existingKyc.motif_rejet || 'Aucun motif renseigné. Veuillez contacter le support.'}
                </p>
              </div>

              {/* Score précédent */}
              {existingKyc.verification_score != null && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <p className="text-xs text-slate-500 font-bold mb-1">Score IA précédent</p>
                  <p className="text-lg font-black text-slate-700">{existingKyc.verification_score}/100</p>
                </div>
              )}

              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
                <h3 className="text-sm font-black text-blue-700 mb-2">📝 Que faire ?</h3>
                <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
                  <li>Corrigez les problèmes signalés ci-dessus</li>
                  <li>Reprenez votre pièce d&apos;identité et/ou votre selfie</li>
                  <li>Remplissez à nouveau le formulaire ci-dessous</li>
                  <li>La vérification IA relancera automatiquement</li>
                </ol>
              </div>

              {/* Nouveau formulaire */}
              <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-6">
                <section>
                  <h2 className="text-lg font-black tracking-tight text-slate-900 mb-4 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                    Informations personnelles
                  </h2>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {FIELD_EXPLANATIONS.filter(f => ['Prénom', 'Nom de naissance', 'Date de naissance', 'Nationalité'].includes(f.label)).map(field => {
                      const fieldKey = field.label === 'Prénom' ? 'prenom'
                        : field.label === 'Nom de naissance' ? 'nom_naissance'
                        : field.label === 'Date de naissance' ? 'date_naissance'
                        : 'nationalite';

                      const comparison = verificationResult?.fieldComparison[fieldKey as keyof typeof verificationResult.fieldComparison];

                      return (
                        <div key={field.label}>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                            <span>{field.icon}</span>
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                          </label>
                          <input
                            type={fieldKey === 'date_naissance' ? 'date' : 'text'}
                            required={field.required}
                            value={form[fieldKey as keyof FormData]}
                            onChange={e => updateForm(fieldKey as keyof FormData, e.target.value)}
                            className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
                              comparison
                                ? comparison.match
                                  ? 'border-emerald-300 bg-emerald-50'
                                  : 'border-red-300 bg-red-50'
                                : 'border-slate-200'
                            }`}
                            placeholder={field.label}
                          />
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{field.description}</p>
                          {comparison && (
                            <div className={`mt-2 p-3 rounded-lg border ${
                              comparison.match
                                ? 'bg-emerald-50 border-emerald-200'
                                : 'bg-red-50 border-red-200'
                            }`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className={`text-xs font-bold ${
                                  comparison.match ? 'text-emerald-700' : 'text-red-700'
                                }`}>
                                  {comparison.match ? '✓ Correspond' : '✗ Ne correspond pas'}
                                </span>
                                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                                  comparison.score >= 80 ? 'bg-emerald-100 text-emerald-700'
                                    : comparison.score >= 50 ? 'bg-amber-100 text-amber-700'
                                    : 'bg-red-100 text-red-700'
                                }`}>
                                  {comparison.score}/100
                                </span>
                              </div>
                              <p className="text-xs text-slate-600 leading-relaxed">{comparison.explanation}</p>
                              {comparison.suggestion && (
                                <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                                  <p className="text-xs text-blue-700 font-bold">💡 Suggestion :</p>
                                  <p className="text-xs text-blue-600">{comparison.suggestion}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {role === 'entreprise' && (
                    <div className="mt-4">
                      {(() => {
                        const field = FIELD_EXPLANATIONS.find(f => f.label === 'Nom de l\'entreprise');
                        if (!field) return null;
                        return (
                          <>
                            <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                              <span>{field.icon}</span>
                              {field.label}
                            </label>
                            <input
                              type="text"
                              value={form.nom_entreprise}
                              onChange={e => updateForm('nom_entreprise', e.target.value)}
                              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                              placeholder="Raison sociale"
                            />
                            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{field.description}</p>
                          </>
                        );
                      })()}
                    </div>
                  )}
                </section>

                <section>
                  <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                    Pièce d&apos;identité *
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mb-3">
                    Carte nationale d&apos;identité, passeport ou permis de conduire. Photo claire des deux côtés.
                  </p>
                  <PhotoCapture
                    onCapture={(file) => {
                      setPieceIdentite(file);
                      setPiecePreview(URL.createObjectURL(file));
                      setAutoSubmitted(false);
                    }}
                    label="Importer votre pièce d'identité"
                    sublabel="JPG, PNG ou PDF (max 5 Mo)"
                    icon="📄"
                  />
                </section>

                <section>
                  <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                    Selfie de vérification *
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mb-3">
                    Prenez un selfie face caméra. Votre visage doit être clairement visible.
                  </p>
                  <PhotoCapture
                    onCapture={(file) => {
                      setSelfie(file);
                      setSelfiePreview(URL.createObjectURL(file));
                      setAutoSubmitted(false);
                    }}
                    label="Importer un selfie"
                    sublabel="Photo de vous-même (JPG, PNG)"
                    icon="🤳"
                    accept="image/*"
                  />
                </section>

                {role === 'entreprise' && (
                  <section>
                    <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2 flex items-center gap-2">
                      <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">4</span>
                      Document entreprise *
                    </h2>
                    <PhotoCapture
                      onCapture={setDocEntreprise}
                      label="Importer un document d'entreprise"
                      sublabel="K-bis ou registre du commerce"
                      icon="🏢"
                    />
                  </section>
                )}

                {/* Loading IA */}
                {verifying && (
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                    <p className="text-sm font-bold text-blue-700">Analyse IA en cours...</p>
                    <p className="text-xs text-blue-500 mt-1">Comparaison des photos et extraction des informations</p>
                  </div>
                )}

                {/* Résultat IA */}
                {verificationResult && !verifying && (
                  <Card className="p-6 space-y-4">
                    <h3 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
                      🤖 Résultat de la vérification IA
                    </h3>

                    <div className={`p-4 rounded-2xl border-2 ${
                      verificationResult.overallScore >= 80
                        ? 'bg-emerald-50 border-emerald-200'
                        : verificationResult.overallScore >= 50
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-red-50 border-red-200'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-700">Score global</span>
                        <span className={`text-2xl font-black ${
                          verificationResult.overallScore >= 80 ? 'text-emerald-600'
                            : verificationResult.overallScore >= 50 ? 'text-amber-600'
                            : 'text-red-600'
                        }`}>
                          {verificationResult.overallScore}/100
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">{verificationResult.overallExplanation}</p>
                    </div>

                    {/* Visages côte à côte */}
                    {(piecePreview || selfiePreview) && (
                      <div className="grid grid-cols-2 gap-3">
                        {piecePreview && (
                          <div className="relative">
                            <img src={piecePreview} alt="Pièce" className="w-full h-36 object-cover rounded-xl border-2 border-slate-200" />
                            <span className="absolute top-2 left-2 bg-slate-900/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Pièce</span>
                          </div>
                        )}
                        {selfiePreview && (
                          <div className="relative">
                            <img src={selfiePreview} alt="Selfie" className="w-full h-36 object-cover rounded-xl border-2 border-slate-200" />
                            <span className="absolute top-2 left-2 bg-slate-900/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Selfie</span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <div className={`flex-1 h-0.5 ${verificationResult.faceMatch.isMatch ? 'bg-emerald-400' : 'bg-red-400'}`} />
                      <span className="text-lg">{verificationResult.faceMatch.isMatch ? '🤝' : '⚠️'}</span>
                      <div className={`flex-1 h-0.5 ${verificationResult.faceMatch.isMatch ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-slate-700">📸 Comparaison des visages</span>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                          verificationResult.faceMatch.isMatch ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {verificationResult.faceMatch.isMatch ? '✓ Correspondance' : '✗ Non identique'} — {verificationResult.faceMatch.score}/100
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">{verificationResult.faceMatch.explanation}</p>
                    </div>

                    {verificationResult.recommendations.length > 0 && (
                      <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                        <h4 className="text-sm font-bold text-amber-700 mb-2">⚠️ Recommandations</h4>
                        <ul className="space-y-1">
                          {verificationResult.recommendations.map((rec, i) => (
                            <li key={i} className="text-xs text-amber-600">• {rec}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Bouton soumettre */}
                    {!autoSubmitted && (
                      <Button
                        type="button"
                        onClick={handleManualSubmit}
                        disabled={submitting}
                        variant="primary"
                        size="lg"
                        className="w-full"
                      >
                        {submitting ? 'Soumission en cours...' : '✓ Soumettre mon KYC aux administrateurs'}
                      </Button>
                    )}

                    {autoSubmitted && (
                      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                        <p className="text-sm font-bold text-emerald-700">✓ Soumis aux administrateurs pour validation</p>
                        <p className="text-xs text-emerald-600 mt-1">Vous recevrez une notification une fois le dossier examiné.</p>
                      </div>
                    )}
                  </Card>
                )}

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    🔒 Vos documents sont stockés de manière sécurisée et ne sont accessibles que par notre équipe administrative.
                  </p>
                </div>
              </form>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 font-sans antialiased">
      <div className="max-w-2xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Tableau de bord', href: '/dashboard' },
          { label: 'KYC' },
        ]} />

        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="bg-blue-600 p-6 text-white text-center">
            <h1 className="text-2xl font-black tracking-tight">Vérification d&apos;identité</h1>
            <p className="text-blue-200 text-sm font-medium mt-1">
              Étape obligatoire pour accéder à la plateforme
            </p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); }} className="p-6 md:p-8 space-y-8">

            <section>
              <h2 className="text-lg font-black tracking-tight text-slate-900 mb-4 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                Informations personnelles
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {FIELD_EXPLANATIONS.filter(f => ['Prénom', 'Nom de naissance', 'Date de naissance', 'Nationalité'].includes(f.label)).map(field => {
                  const fieldKey = field.label === 'Prénom' ? 'prenom'
                    : field.label === 'Nom de naissance' ? 'nom_naissance'
                    : field.label === 'Date de naissance' ? 'date_naissance'
                    : 'nationalite';

                  const comparison = verificationResult?.fieldComparison[fieldKey as keyof typeof verificationResult.fieldComparison];

                  return (
                    <div key={field.label}>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                        <span>{field.icon}</span>
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type={fieldKey === 'date_naissance' ? 'date' : 'text'}
                        required={field.required}
                        value={form[fieldKey as keyof FormData]}
                        onChange={e => updateForm(fieldKey as keyof FormData, e.target.value)}
                        className={`w-full rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition ${
                          comparison
                            ? comparison.match
                              ? 'border-emerald-300 bg-emerald-50'
                              : 'border-red-300 bg-red-50'
                            : 'border-slate-200'
                        }`}
                        placeholder={field.label}
                      />
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{field.description}</p>
                      {comparison && (
                        <div className={`mt-2 p-3 rounded-lg border ${
                          comparison.match
                            ? 'bg-emerald-50 border-emerald-200'
                            : 'bg-red-50 border-red-200'
                        }`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-bold ${
                              comparison.match ? 'text-emerald-700' : 'text-red-700'
                            }`}>
                              {comparison.match ? '✓ Correspond' : '✗ Ne correspond pas'}
                            </span>
                            <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                              comparison.score >= 80 ? 'bg-emerald-100 text-emerald-700'
                                : comparison.score >= 50 ? 'bg-amber-100 text-amber-700'
                                : 'bg-red-100 text-red-700'
                            }`}>
                              {comparison.score}/100
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 leading-relaxed">{comparison.explanation}</p>
                          {comparison.suggestion && (
                            <div className="mt-2 p-2 bg-blue-50 rounded-lg border border-blue-200">
                              <p className="text-xs text-blue-700 font-bold">💡 Suggestion :</p>
                              <p className="text-xs text-blue-600">{comparison.suggestion}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {role === 'entreprise' && (
                <div className="mt-4">
                  {(() => {
                    const field = FIELD_EXPLANATIONS.find(f => f.label === 'Nom de l\'entreprise');
                    if (!field) return null;
                    return (
                      <>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                          <span>{field.icon}</span>
                          {field.label}
                        </label>
                        <input
                          type="text"
                          value={form.nom_entreprise}
                          onChange={e => updateForm('nom_entreprise', e.target.value)}
                          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                          placeholder="Raison sociale"
                        />
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{field.description}</p>
                      </>
                    );
                  })()}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                Pièce d&apos;identité *
              </h2>
              <p className="text-xs text-slate-500 font-medium mb-3">
                Carte nationale d&apos;identité, passeport ou permis de conduire. Photo claire des deux côtés.
              </p>
              <PhotoCapture
                onCapture={(file) => {
                  setPieceIdentite(file);
                  setPiecePreview(URL.createObjectURL(file));
                  setAutoSubmitted(false);
                }}
                label="Importer votre pièce d'identité"
                sublabel="JPG, PNG ou PDF (max 5 Mo)"
                icon="📄"
              />
            </section>

            <section>
              <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                Selfie de vérification *
              </h2>
              <p className="text-xs text-slate-500 font-medium mb-3">
                Prenez un selfie face caméra. Votre visage doit être clairement visible.
              </p>
              <PhotoCapture
                onCapture={(file) => {
                  setSelfie(file);
                  setSelfiePreview(URL.createObjectURL(file));
                  setAutoSubmitted(false);
                }}
                label="Importer un selfie"
                sublabel="Photo de vous-même (JPG, PNG)"
                icon="🤳"
                accept="image/*"
              />
            </section>

            {role === 'entreprise' && (
              <section>
                <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2 flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">4</span>
                  Document entreprise *
                </h2>
                <PhotoCapture
                  onCapture={setDocEntreprise}
                  label="Importer un document d'entreprise"
                  sublabel="K-bis ou registre du commerce"
                  icon="🏢"
                />
              </section>
            )}

            {/* Loading IA */}
            {verifying && (
              <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 text-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm font-bold text-blue-700">Analyse IA en cours...</p>
                <p className="text-xs text-blue-500 mt-1">Comparaison des photos et extraction des informations</p>
              </div>
            )}

            {/* Résultat IA */}
            {verificationResult && !verifying && (
              <Card className="p-6 space-y-4">
                <h3 className="text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
                  🤖 Résultat de la vérification IA
                </h3>

                <div className={`p-4 rounded-2xl border-2 ${
                  verificationResult.overallScore >= 80
                    ? 'bg-emerald-50 border-emerald-200'
                    : verificationResult.overallScore >= 50
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-700">Score global</span>
                    <span className={`text-2xl font-black ${
                      verificationResult.overallScore >= 80 ? 'text-emerald-600'
                        : verificationResult.overallScore >= 50 ? 'text-amber-600'
                        : 'text-red-600'
                    }`}>
                      {verificationResult.overallScore}/100
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{verificationResult.overallExplanation}</p>
                </div>

                {/* Visages côte à côte */}
                {(piecePreview || selfiePreview) && (
                  <div className="grid grid-cols-2 gap-3">
                    {piecePreview && (
                      <div className="relative">
                        <img src={piecePreview} alt="Pièce" className="w-full h-36 object-cover rounded-xl border-2 border-slate-200" />
                        <span className="absolute top-2 left-2 bg-slate-900/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Pièce</span>
                      </div>
                    )}
                    {selfiePreview && (
                      <div className="relative">
                        <img src={selfiePreview} alt="Selfie" className="w-full h-36 object-cover rounded-xl border-2 border-slate-200" />
                        <span className="absolute top-2 left-2 bg-slate-900/70 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Selfie</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div className={`flex-1 h-0.5 ${verificationResult.faceMatch.isMatch ? 'bg-emerald-400' : 'bg-red-400'}`} />
                  <span className="text-lg">{verificationResult.faceMatch.isMatch ? '🤝' : '⚠️'}</span>
                  <div className={`flex-1 h-0.5 ${verificationResult.faceMatch.isMatch ? 'bg-emerald-400' : 'bg-red-400'}`} />
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-slate-700">📸 Comparaison des visages</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                      verificationResult.faceMatch.isMatch ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {verificationResult.faceMatch.isMatch ? '✓ Correspondance' : '✗ Non identique'} — {verificationResult.faceMatch.score}/100
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{verificationResult.faceMatch.explanation}</p>
                </div>

                {verificationResult.recommendations.length > 0 && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                    <h4 className="text-sm font-bold text-amber-700 mb-2">⚠️ Recommandations</h4>
                    <ul className="space-y-1">
                      {verificationResult.recommendations.map((rec, i) => (
                        <li key={i} className="text-xs text-amber-600">• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Bouton soumettre */}
                {!autoSubmitted && (
                  <Button
                    type="button"
                    onClick={handleManualSubmit}
                    disabled={submitting}
                    variant="primary"
                    size="lg"
                    className="w-full"
                  >
                    {submitting ? 'Soumission en cours...' : '✓ Soumettre mon KYC aux administrateurs'}
                  </Button>
                )}

                {autoSubmitted && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                    <p className="text-sm font-bold text-emerald-700">✓ Soumis aux administrateurs pour validation</p>
                    <p className="text-xs text-emerald-600 mt-1">Vous recevrez une notification une fois le dossier examiné.</p>
                  </div>
                )}
              </Card>
            )}

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                🔒 Vos documents sont stockés de manière sécurisée et ne sont accessibles que par notre équipe administrative.
              </p>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
