'use client';

import { useEffect, useState } from 'react';
import { Skeleton, SkeletonCard } from '@/components/Skeleton';
import { supabase } from '@/lib/supabaseClient';
import { useRouter, useParams } from 'next/navigation';
import Link from '@/components/Link';
import { formatDate } from '@/lib/i18n';

type UserData = {
  id: string;
  nom: string;
  email: string;
  telephone: string | null;
  role: string;
  created_at: string;
};

type SecretaireProfil = {
  photo_url: string | null;
  bio: string | null;
  ville: string | null;
  disponibilite: string | null;
  niveau_etudes: string | null;
  specialite: string | null;
  langues: string[] | null;
  outils: string[] | null;
  soft_skills: string[] | null;
  competences: string[] | null;
  annees_experience: number | null;
};

type KycData = {
  statut: string | null;
  created_at: string | null;
};

type TwoFactorData = {
  enabled: boolean | null;
};

const DISPO_LABEL: Record<string, string> = {
  immediate: 'Immédiate',
  semaine: 'Sous une semaine',
  mois: 'Sous un mois',
  a_discuter: 'À discuter',
};

const ROLE_BADGE: Record<string, string> = {
  entreprise: 'bg-blue-100 text-blue-700',
  secretaire: 'bg-emerald-100 text-emerald-700',
  admin: 'bg-amber-100 text-amber-800',
};

export default function DetailUtilisateur() {
  const router = useRouter();
  const params = useParams();
  const userId = params.id as string;

  const [user, setUser] = useState<UserData | null>(null);
  const [secProfil, setSecProfil] = useState<SecretaireProfil | null>(null);
  const [kyc, setKyc] = useState<KycData | null>(null);
  const [twoFactor, setTwoFactor] = useState<TwoFactorData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/connexion'); return; }

      const { data: my } = await supabase.from('profils').select('role').eq('id', session.user.id).maybeSingle();
      if (my?.role !== 'admin') { router.push('/dashboard'); return; }

      const { data: profil } = await supabase
        .from('profils')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profil) setUser(profil as UserData);

      if (profil?.role === 'secretaire') {
        const { data: sp } = await supabase
          .from('profils_secretaires')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        setSecProfil(sp as SecretaireProfil | null);

        const { data: kycData } = await supabase
          .from('kyc_verifications')
          .select('statut, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setKyc(kycData as KycData | null);

        const { data: tfa } = await supabase
          .from('two_factor_auth')
          .select('enabled')
          .eq('user_id', userId)
          .maybeSingle();
        setTwoFactor(tfa as TwoFactorData | null);
      }

      setLoading(false);
    };
    run();
  }, [router, userId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
          <div className="space-y-3 pt-4">
            {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <div className="p-12 text-center text-red-500 font-bold font-sans">Utilisateur introuvable.</div>;
  }

  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 font-sans antialiased">
      <div className="max-w-3xl mx-auto">
        <Link
          href="/dashboard/admin/utilisateurs"
          className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 mb-6 transition"
        >
          ← Retour à la gestion des utilisateurs
        </Link>

        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-br from-slate-700 to-slate-900 p-8 text-white">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-black">
                {user.nom?.charAt(0) || '?'}
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight">{user.nom || '—'}</h1>
                <p className="text-sm text-white/70 mt-1">{user.email}</p>
                <span className={`inline-block mt-2 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${ROLE_BADGE[user.role] || ''}`}>
                  {user.role}
                </span>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6">

            {/* Infos générales */}
            <section>
              <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">Informations générales</h2>
              <div className="grid grid-cols-2 gap-4">
                <InfoCell label="Téléphone" value={user.telephone} />
                <InfoCell label="Inscrit le" value={formatDate(user.created_at)} />
                {user.role === 'secretaire' && (
                  <>
                    <InfoCell label="Spécialité" value={secProfil?.specialite} />
                    <InfoCell label="Ville" value={secProfil?.ville} />
                    <InfoCell label="Disponibilité" value={secProfil?.disponibilite ? DISPO_LABEL[secProfil.disponibilite] || secProfil.disponibilite : null} />
                    <InfoCell label="Niveau d'études" value={secProfil?.niveau_etudes} />
                    <InfoCell label="Expérience" value={secProfil?.annees_experience ? `${secProfil.annees_experience} ans` : null} />
                  </>
                )}
              </div>
            </section>

            {/* Profil secrétaire */}
            {user.role === 'secretaire' && secProfil && (
              <>
                <hr className="border-slate-100" />
                <section>
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">Profil métier</h2>
                  {secProfil.bio && (
                    <p className="text-sm text-slate-700 italic mb-4">{secProfil.bio}</p>
                  )}
                  {secProfil.competences && secProfil.competences.length > 0 && (
                    <ChipsBlock label="Compétences" items={secProfil.competences} color="slate" />
                  )}
                  {secProfil.outils && secProfil.outils.length > 0 && (
                    <ChipsBlock label="Outils" items={secProfil.outils} color="blue" />
                  )}
                  {secProfil.soft_skills && secProfil.soft_skills.length > 0 && (
                    <ChipsBlock label="Soft skills" items={secProfil.soft_skills} color="emerald" />
                  )}
                  {secProfil.langues && secProfil.langues.length > 0 && (
                    <ChipsBlock label="Langues" items={secProfil.langues} color="amber" />
                  )}
                </section>

                <hr className="border-slate-100" />

                {/* KYC + 2FA */}
                <section>
                  <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3">Sécurité</h2>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">KYC</p>
                      <span className={`text-sm font-bold ${kyc?.statut === 'approved' ? 'text-emerald-600' : kyc?.statut === 'rejected' ? 'text-red-600' : 'text-slate-500'}`}>
                        {kyc?.statut === 'approved' ? '✅ Approuvé' : kyc?.statut === 'rejected' ? '❌ Rejeté' : kyc?.statut === 'pending' ? '⏳ En attente' : 'Non soumis'}
                      </span>
                    </div>
                    <div className="p-4 rounded-2xl border border-slate-100 bg-slate-50">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Double authentification</p>
                      <span className={`text-sm font-bold ${twoFactor?.enabled ? 'text-emerald-600' : 'text-red-600'}`}>
                        {twoFactor?.enabled ? '✅ Activée' : '❌ Désactivée'}
                      </span>
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function InfoCell({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="p-3 rounded-xl border border-slate-100 bg-slate-50">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-bold text-slate-800">{value || '—'}</p>
    </div>
  );
}

function ChipsBlock({ label, items, color }: { label: string; items: string[]; color: string }) {
  const colorMap: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className="mb-4">
      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <span key={item} className={`text-xs font-bold px-2.5 py-1 rounded-full ${colorMap[color] || colorMap.slate}`}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
