'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { toast } from '@/components/Toast';

type FormData = {
  prenom: string;
  nom_naissance: string;
  date_naissance: string;
  nationalite: string;
  nom_entreprise: string;
};

export default function KycPage() {
  const router = useRouter();
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState<'entreprise' | 'secretaire'>('entreprise');
  const [existingKyc, setExistingKyc] = useState<{ status: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

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

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/connexion'); return; }

      setUserId(session.user.id);

      const { data: profil } = await supabase
        .from('profils')
        .select('role, nom')
        .eq('id', session.user.id)
        .single();

      if (profil) {
        setRole(profil.role as 'entreprise' | 'secretaire');
        setForm(prev => ({ ...prev, prenom: profil.nom || '' }));
      }

      // Vérifier si un KYC existe déjà
      const { data: kyc } = await supabase
        .from('kyc_verifications')
        .select('status')
        .eq('user_id', session.user.id)
        .single();

      if (kyc) setExistingKyc(kyc);

      setLoading(false);
    };
    fetchData();
  }, [router]);

  const updateForm = (field: keyof FormData, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const uploadFile = async (file: File, bucket: string): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const path = `${userId}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage.from(bucket).upload(path, file, {
      contentType: file.type,
      upsert: true,
    });

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.prenom.trim() || !form.nom_naissance.trim() || !form.date_naissance) {
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

    if (role === 'entreprise' && !docEntreprise) {
      toast.error('Veuillez télécharger un document d\'entreprise (K-bis).');
      return;
    }

    setSubmitting(true);

    // Upload des fichiers
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

    let docEntrepriseUrl = null;
    if (role === 'entreprise' && docEntreprise) {
      docEntrepriseUrl = await uploadFile(docEntreprise, 'kyc-entreprises');
      if (!docEntrepriseUrl) {
        toast.error('Erreur lors de l\'upload du document entreprise.');
        setSubmitting(false);
        return;
      }
    }

    // Enregistrer le KYC
    const kycData = {
      user_id: userId,
      status: 'pending',
      prenom: form.prenom.trim(),
      nom_naissance: form.nom_naissance.trim(),
      date_naissance: form.date_naissance,
      nationalite: form.nationalite.trim() || null,
      type_compte: role,
      piece_identite_url: identiteUrl,
      selfie_url: selfieUrl,
      document_entreprise_url: docEntrepriseUrl,
      nom_entreprise: role === 'entreprise' ? form.nom_entreprise.trim() || null : null,
    };

    // Upsert (insert ou update)
    const { error } = await supabase
      .from('kyc_verifications')
      .upsert(kycData, { onConflict: 'user_id' });

    if (error) {
      toast.error('Erreur : ' + error.message);
      setSubmitting(false);
      return;
    }

    toast.success('Demande KYC soumise avec succès !');
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Si KYC déjà soumis et en attente
  if (existingKyc?.status === 'pending') {
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

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 font-sans antialiased">
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="inline-flex flex-col items-center hover:opacity-90 transition mb-8">
          <Image src="/logo.png" alt="Logo SecrétariatPro" width={56} height={56} priority className="rounded-2xl mb-2 object-contain shadow-lg shadow-blue-100" />
          <span className="text-xl font-black tracking-tight text-slate-900">
            Secrétariat<span className="text-blue-600">Pro</span>
          </span>
        </Link>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] overflow-hidden">
          <div className="bg-blue-600 p-6 text-white text-center">
            <h1 className="text-2xl font-black tracking-tight">Vérification d&apos;identité</h1>
            <p className="text-blue-200 text-sm font-medium mt-1">
              Étape obligatoire pour accéder à la plateforme
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-8">

            {/* Étape 1 : Informations personnelles */}
            <section>
              <h2 className="text-lg font-black tracking-tight text-slate-900 mb-4 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                Informations personnelles
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Prénom *</label>
                  <input
                    type="text"
                    required
                    value={form.prenom}
                    onChange={e => updateForm('prenom', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="Votre prénom"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Nom de naissance *</label>
                  <input
                    type="text"
                    required
                    value={form.nom_naissance}
                    onChange={e => updateForm('nom_naissance', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="Nom sur votre pièce d'identité"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Date de naissance *</label>
                  <input
                    type="date"
                    required
                    value={form.date_naissance}
                    onChange={e => updateForm('date_naissance', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Nationalité</label>
                  <input
                    type="text"
                    value={form.nationalite}
                    onChange={e => updateForm('nationalite', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="Ex: Ivoirienne"
                  />
                </div>
              </div>
            </section>

            {/* Étape 2 : Pièce d'identité */}
            <section>
              <h2 className="text-lg font-black tracking-tight text-slate-900 mb-4 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                Pièce d&apos;identité *
              </h2>
              <p className="text-xs text-slate-500 font-medium mb-3">
                Carte nationale d&apos;identité, passeport ou permis de conduire. Photo claire des deux côtés.
              </p>
              <label className="block w-full border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={e => setPieceIdentite(e.target.files?.[0] ?? null)}
                />
                {pieceIdentite ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-emerald-500 text-xl">✓</span>
                    <span className="text-sm font-bold text-slate-700">{pieceIdentite.name}</span>
                  </div>
                ) : (
                  <div>
                    <p className="text-3xl mb-2">📄</p>
                    <p className="text-sm font-bold text-slate-600">Cliquez pour télécharger</p>
                    <p className="text-xs text-slate-400 mt-1">JPG, PNG ou PDF (max 5 Mo)</p>
                  </div>
                )}
              </label>
            </section>

            {/* Étape 3 : Selfie */}
            <section>
              <h2 className="text-lg font-black tracking-tight text-slate-900 mb-4 flex items-center gap-2">
                <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                Selfie de vérification *
              </h2>
              <p className="text-xs text-slate-500 font-medium mb-3">
                Prenez un selfie face caméra. Votre visage doit être clairement visible.
              </p>
              <label className="block w-full border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => setSelfie(e.target.files?.[0] ?? null)}
                />
                {selfie ? (
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-emerald-500 text-xl">✓</span>
                    <span className="text-sm font-bold text-slate-700">{selfie.name}</span>
                  </div>
                ) : (
                  <div>
                    <p className="text-3xl mb-2">🤳</p>
                    <p className="text-sm font-bold text-slate-600">Cliquez pour télécharger</p>
                    <p className="text-xs text-slate-400 mt-1">Photo de vous-même (JPG, PNG)</p>
                  </div>
                )}
              </label>
            </section>

            {/* Étape 4 : Document entreprise (si entreprise) */}
            {role === 'entreprise' && (
              <section>
                <h2 className="text-lg font-black tracking-tight text-slate-900 mb-4 flex items-center gap-2">
                  <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold">4</span>
                  Document entreprise *
                </h2>
                <p className="text-xs text-slate-500 font-medium mb-3">
                  K-bis, registre du commerce ou équivalent.
                </p>

                <div className="mb-4">
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Nom de l&apos;entreprise</label>
                  <input
                    type="text"
                    value={form.nom_entreprise}
                    onChange={e => updateForm('nom_entreprise', e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    placeholder="Raison sociale"
                  />
                </div>

                <label className="block w-full border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition">
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={e => setDocEntreprise(e.target.files?.[0] ?? null)}
                  />
                  {docEntreprise ? (
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-emerald-500 text-xl">✓</span>
                      <span className="text-sm font-bold text-slate-700">{docEntreprise.name}</span>
                    </div>
                  ) : (
                    <div>
                      <p className="text-3xl mb-2">🏢</p>
                      <p className="text-sm font-bold text-slate-600">Cliquez pour télécharger</p>
                      <p className="text-xs text-slate-400 mt-1">K-bis ou registre du commerce</p>
                    </div>
                  )}
                </label>
              </section>
            )}

            {/* Confidentialité */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                🔒 Vos documents sont stockés de manière sécurisée et ne sont accessibles que par notre équipe administrative.
                Ils sont utilisés uniquement à des fins de vérification d&apos;identité.
              </p>
            </div>

            {/* Bouton */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-4 rounded-full bg-blue-600 text-white font-extrabold tracking-tight text-base hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Envoi en cours...' : 'Soumettre ma vérification'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
