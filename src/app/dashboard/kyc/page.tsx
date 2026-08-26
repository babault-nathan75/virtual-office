'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from '@/components/Link';
import { toast } from '@/components/Toast';
import { Button, Breadcrumbs } from '@/components/ui';
import { PhotoCapture } from '@/components/PhotoCapture';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { roleHome, type Role } from '@/lib/roleStore';
import { revalidateScope } from '@/lib/actions/cache';

type FormData = {
  prenoms: string;
  nom: string;
  date_naissance: string;
  nationalite: string;
};

type FieldExplanation = {
  label: string;
  description: string;
  icon: string;
  required: boolean;
};

const FIELD_EXPLANATIONS: FieldExplanation[] = [
  {
    label: 'Prénoms',
    description: 'Le(s) prénom(s) tel qu\'il apparaît(ssent) sur votre pièce d\'identité officielle.',
    icon: '👤',
    required: true,
  },
  {
    label: 'Nom',
    description: 'Votre nom de famille tel qu\'il figure sur votre acte de naissance et votre pièce d\'identité.',
    icon: '📋',
    required: true,
  },
  {
    label: 'Date de naissance',
    description: 'Votre date de naissance au format jour/mois/année.',
    icon: '📅',
    required: true,
  },
  {
    label: 'Nationalité',
    description: 'Votre nationalité actuelle telle que mentionnée sur votre pièce d\'identité.',
    icon: '🌍',
    required: false,
  },
];

type ExistingKyc = {
  statut: string;
  motif_rejet: string | null;
} | null;

export default function KycPage() {
  useDocumentTitle('Vérification d\'identité');
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [existingKyc, setExistingKyc] = useState<ExistingKyc>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState<FormData>({
    prenoms: '',
    nom: '',
    date_naissance: '',
    nationalite: '',
  });

  const [pieceIdentite, setPieceIdentite] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      // Le `finally` garantit la sortie de l'écran de chargement : sur erreur
      // réseau, la page restait bloquée sur le spinner indéfiniment.
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) { router.push('/connexion'); return; }

        setUserId(session.user.id);

        const { data: profil } = await supabase
          .from('profils')
          .select('role, nom')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profil) {
          // La vérification d'identité ne concerne que les secrétaires.
          // Les entreprises étaient déjà redirigées ; les administrateurs, non :
          // ils tombaient sur le formulaire KYC destiné aux secrétaires.
          if (profil.role !== 'secretaire') {
            router.replace(roleHome(profil.role as Role));
            return;
          }
          setForm(prev => ({ ...prev, prenoms: profil.nom || '' }));
        }

        const { data: kyc } = await supabase
          .from('kyc_verifications')
          .select('statut, motif_rejet')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (kyc) setExistingKyc(kyc as ExistingKyc);
      } catch (error) {
        console.error('[kyc] Chargement échoué :', error);
        toast.error('Impossible de charger votre dossier. Veuillez réessayer.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [router]);

  const updateForm = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const uploadFile = async (file: File, bucket: string): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const path = `${userId}/${Date.now()}.${ext}`;
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) return null;
    return data?.path ?? path;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.prenoms.trim() || !form.nom.trim() || !form.date_naissance) {
      toast.error('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (!pieceIdentite) {
      toast.error('Veuillez télécharger votre pièce d\'identité.');
      return;
    }
    if (!selfie) {
      toast.error('Veuillez télécharger un selfie.');
      return;
    }

    setSubmitting(true);

    const identiteUrl = await uploadFile(pieceIdentite, 'kyc-identite');
    if (!identiteUrl) {
      toast.error('Erreur lors de l\'upload de la pièce d\'identité.');
      setSubmitting(false);
      return;
    }

    const selfieUrl = await uploadFile(selfie, 'kyc-selfies');
    if (!selfieUrl) {
      toast.error('Erreur lors de l\'upload du selfie.');
      setSubmitting(false);
      return;
    }

    const kycData = {
      user_id: userId,
      statut: 'pending',
      prenom: form.prenoms.trim(),
      nom: form.nom.trim(),
      date_naissance: form.date_naissance,
      nationalite: form.nationalite.trim() || null,
      // Toujours « secretaire » : cet écran redirige tout compte d'un autre
      // rôle (voir le garde plus haut), il n'existe donc aujourd'hui aucun
      // parcours de vérification d'identité pour les entreprises.
      //
      // Conséquence à connaître : `dashboard/secretaire/missions` filtre les
      // dossiers sur `type_compte = 'entreprise'` et ne trouvera jamais rien —
      // une secrétaire ne peut pas savoir si l'entreprise qui la sollicite a
      // été vérifiée. Combler ce manque est un travail de produit, pas une
      // correction de filtre.
      type_compte: 'secretaire',
      piece_identite_url: identiteUrl,
      selfie_url: selfieUrl,
      motif_rejet: null,
      // Date de cette soumission. Sans elle, un dossier refusé puis corrigé
      // conservait la date du premier envoi : l'administrateur voyait un
      // dossier « soumis » des semaines plus tôt et le classait en bas de
      // liste, alors qu'il venait d'être retravaillé.
      derniere_soumission_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from('kyc_verifications')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    const submit = (payload: Record<string, unknown>) =>
      existing?.id
        ? supabase.from('kyc_verifications').update(payload).eq('user_id', userId)
        : supabase.from('kyc_verifications').insert(payload);

    let { error } = await submit(kycData);

    // Repli si la migration 008 n'a pas encore été appliquée : le dossier doit
    // partir malgré tout, quitte à perdre la date de resoumission.
    if (error && (error.code === 'PGRST204' || error.code === '42703') &&
        error.message?.includes('derniere_soumission_at')) {
      const { derniere_soumission_at: _ignored, ...sansDate } = kycData;
      ({ error } = await submit(sansDate));
    }

    if (error) {
      toast.error('Erreur : ' + error.message);
      setSubmitting(false);
      return;
    }

    // Notifier les admins via ntfy
    try {
      await fetch('/api/kyc/notify-admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          prenom: form.prenoms.trim(),
          nom: form.nom.trim(),
          type: 'secretaire',
        }),
      });
    } catch {
      // Non bloquant
    }

    setExistingKyc({ statut: 'pending', motif_rejet: null });
    toast.success('KYC soumis ! En attente de validation par un administrateur.');
    // Fait apparaître le dossier dans la file d'attente des administrateurs, et
    // met à jour le statut affiché sur le tableau de bord de la secrétaire,
    // tous deux servis depuis un cache.
    await revalidateScope('admin-kyc');
    router.push('/dashboard');
    router.refresh();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // KYC en attente
  if (existingKyc?.statut === 'pending') {
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

  // KYC approuvé — sans cet écran, un dossier déjà validé réaffichait le
  // formulaire vierge, dont l'envoi repassait le statut à « pending ».
  if (existingKyc?.statut === 'approved') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans antialiased">
        <div className="max-w-md w-full bg-white rounded-3xl border border-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] p-8 text-center">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900 mb-2">
            Identité vérifiée
          </h1>
          <p className="text-slate-500 font-medium text-sm mb-6">
            Votre dossier a été approuvé. Votre profil est visible par les entreprises.
          </p>
          <Link
            href="/dashboard/secretaire"
            className="block w-full py-3.5 rounded-full bg-blue-600 text-white font-bold hover:bg-blue-700 transition text-sm"
          >
            Accéder à mon tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  // KYC rejeté
  if (existingKyc?.statut === 'rejected') {
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
            </div>

            <div className="p-6 md:p-8 space-y-6">
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5">
                <h3 className="text-sm font-black text-red-700 mb-2">⚠️ Raison du refus</h3>
                <p className="text-sm text-red-800 leading-relaxed">
                  {existingKyc.motif_rejet || 'Aucun motif renseigné.'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <section>
                  <h2 className="text-lg font-black tracking-tight text-slate-900 mb-4 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                    Informations personnelles
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {FIELD_EXPLANATIONS.filter(f => ['Prénoms', 'Nom', 'Date de naissance', 'Nationalité'].includes(f.label)).map(field => {
                      const fieldKey = field.label === 'Prénoms' ? 'prenoms'
                        : field.label === 'Nom' ? 'nom'
                        : field.label === 'Date de naissance' ? 'date_naissance'
                        : 'nationalite';
                      return (
                        <div key={field.label}>
                          <label className="block text-sm font-bold text-slate-700 mb-1.5">
                            {field.icon} {field.label} {field.required && <span className="text-red-500">*</span>}
                          </label>
                          <input
                            type={fieldKey === 'date_naissance' ? 'date' : 'text'}
                            required={field.required}
                            value={form[fieldKey as keyof FormData]}
                            onChange={e => updateForm(fieldKey as keyof FormData, e.target.value)}
                            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                          />
                          <p className="text-xs text-slate-500 mt-1">{field.description}</p>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                    Pièce d&apos;identité *
                  </h2>
                  <PhotoCapture onCapture={setPieceIdentite} label="Importer votre pièce d'identité" sublabel="JPG, PNG ou PDF (max 5 Mo)" icon="📄" accept="image/*,application/pdf" />
                </section>

                <section>
                  <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                    Selfie de vérification *
                  </h2>
                  <PhotoCapture onCapture={setSelfie} label="Importer un selfie" sublabel="Photo de vous-même (JPG, PNG)" icon="🤳" accept="image/*" />
                </section>

                <Button type="submit" disabled={submitting} variant="primary" size="lg" className="w-full">
                  {submitting ? 'Envoi en cours...' : '✓ Soumettre mon KYC'}
                </Button>
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

          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">
            <section>
              <h2 className="text-lg font-black tracking-tight text-slate-900 mb-4 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                Informations personnelles
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {FIELD_EXPLANATIONS.filter(f => ['Prénoms', 'Nom', 'Date de naissance', 'Nationalité'].includes(f.label)).map(field => {
                  const fieldKey = field.label === 'Prénoms' ? 'prenoms'
                    : field.label === 'Nom' ? 'nom'
                    : field.label === 'Date de naissance' ? 'date_naissance'
                    : 'nationalite';
                  return (
                    <div key={field.label}>
                      <label className="block text-sm font-bold text-slate-700 mb-1.5">
                        {field.icon} {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type={fieldKey === 'date_naissance' ? 'date' : 'text'}
                        required={field.required}
                        value={form[fieldKey as keyof FormData]}
                        onChange={e => updateForm(fieldKey as keyof FormData, e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                      />
                      <p className="text-xs text-slate-500 mt-1">{field.description}</p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                Pièce d&apos;identité *
              </h2>
              <p className="text-xs text-slate-500 font-medium mb-3">Carte nationale d&apos;identité, passeport ou permis de conduire.</p>
              <PhotoCapture onCapture={setPieceIdentite} label="Importer votre pièce d'identité" sublabel="JPG, PNG ou PDF (max 5 Mo)" icon="📄" accept="image/*,application/pdf" />
            </section>

            <section>
              <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                Selfie de vérification *
              </h2>
              <p className="text-xs text-slate-500 font-medium mb-3">Prenez un selfie face caméra.</p>
              <PhotoCapture onCapture={setSelfie} label="Importer un selfie" sublabel="Photo de vous-même (JPG, PNG)" icon="🤳" accept="image/*" />
            </section>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                🔒 Vos documents sont stockés de manière sécurisée et ne sont accessibles que par notre équipe administrative.
              </p>
            </div>

            <Button type="submit" disabled={submitting} variant="primary" size="lg" className="w-full">
              {submitting ? 'Envoi en cours...' : '✓ Soumettre mon KYC'}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}
