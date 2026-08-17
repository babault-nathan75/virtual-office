'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useEscapeKey } from '@/hooks/useEscapeKey';

type Role = 'entreprise' | 'secretaire' | 'admin';

type Step = {
  key: string;
  title: string;
  description: string;
  href: string;
  color: string;
  bgLight: string;
  icon: React.ReactNode;
};

const ICONS = {
  profil: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  ),
  identite: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 9h3.75M15 12h3.75M15 15h3.75M4.5 19.5h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5zm6-10.125a1.875 1.875 0 11-3.75 0 1.875 1.875 0 013.75 0zm1.294 6.336a6.721 6.721 0 01-3.17.789 6.721 6.721 0 01-3.168-.789 3.376 3.376 0 016.338 0z" />
    </svg>
  ),
  mission: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  recherche: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  ),
  securite: (
    <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  ),
};

/*
 * Parcours propres à chaque rôle.
 *
 * La version précédente servait le même parcours à tout le monde en se
 * contentant de retirer l'étape KYC aux entreprises : celles-ci étaient donc
 * envoyées vers /dashboard/secretaire/profil, une page qui ne les concerne
 * pas. Les administrateurs, eux, recevaient le parcours secrétaire complet,
 * KYC compris.
 */
const PARCOURS: Record<'entreprise' | 'secretaire', Step[]> = {
  entreprise: [
    {
      key: 'profil',
      title: 'Complétez votre profil',
      description: "Renseignez les informations de votre entreprise : les secrétaires les consultent avant de répondre.",
      href: '/profile',
      color: 'from-blue-500 to-blue-600',
      bgLight: 'bg-blue-50',
      icon: ICONS.profil,
    },
    {
      key: 'mission',
      title: 'Publiez une première mission',
      description: 'Décrivez le besoin, la durée et les compétences attendues pour recevoir des candidatures.',
      href: '/dashboard/entreprise/nouvelle-mission',
      color: 'from-indigo-500 to-purple-600',
      bgLight: 'bg-indigo-50',
      icon: ICONS.mission,
    },
    {
      key: 'recherche',
      title: 'Parcourez les secrétaires',
      description: 'Filtrez par compétences, ville et disponibilité, puis proposez directement une collaboration.',
      href: '/dashboard/entreprise/chercher',
      color: 'from-cyan-500 to-blue-600',
      bgLight: 'bg-cyan-50',
      icon: ICONS.recherche,
    },
    {
      key: 'securite',
      title: 'Sécurisez votre compte',
      description: "Activez la double authentification pour protéger l'accès à vos missions.",
      href: '/dashboard/profil/2fa',
      color: 'from-emerald-500 to-teal-600',
      bgLight: 'bg-emerald-50',
      icon: ICONS.securite,
    },
  ],
  secretaire: [
    {
      key: 'profil',
      title: 'Complétez votre profil',
      description: 'Compétences, expérience et photo : un profil complet est bien plus consulté par les entreprises.',
      href: '/dashboard/secretaire/profil',
      color: 'from-blue-500 to-blue-600',
      bgLight: 'bg-blue-50',
      icon: ICONS.profil,
    },
    {
      key: 'kyc',
      title: 'Vérifiez votre identité',
      description: "Cette étape est obligatoire : sans elle, votre profil reste invisible pour les entreprises.",
      href: '/dashboard/kyc',
      color: 'from-indigo-500 to-purple-600',
      bgLight: 'bg-indigo-50',
      icon: ICONS.identite,
    },
    {
      key: 'missions',
      title: 'Découvrez les missions',
      description: 'Parcourez les missions ouvertes et postulez à celles qui correspondent à votre profil.',
      href: '/dashboard/secretaire/missions',
      color: 'from-cyan-500 to-blue-600',
      bgLight: 'bg-cyan-50',
      icon: ICONS.mission,
    },
    {
      key: 'securite',
      title: 'Sécurisez votre compte',
      description: 'Activez la double authentification pour protéger vos données personnelles.',
      href: '/dashboard/profil/2fa',
      color: 'from-emerald-500 to-teal-600',
      bgLight: 'bg-emerald-50',
      icon: ICONS.securite,
    },
  ],
};

// Report « pour cette session » : distinct de l'achèvement définitif.
const SNOOZE_KEY = 'sp:onboarding-snoozed';

export default function Onboarding() {
  const router = useRouter();
  const pathname = usePathname();
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [steps, setSteps] = useState<Step[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Le guide n'a de sens que dans l'espace connecté : il surgissait
    // auparavant sur n'importe quelle page, y compris en pleine saisie.
    if (!pathname.startsWith('/dashboard')) return;
    if (sessionStorage.getItem(SNOOZE_KEY)) return;

    let cancelled = false;

    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profil } = await supabase
        .from('profils')
        .select('onboarding_completed, role')
        .eq('id', session.user.id)
        .maybeSingle();

      // Les administrateurs n'ont pas de parcours d'accueil.
      const role = profil?.role as Role | undefined;
      if (!profil || profil.onboarding_completed) return;
      if (role !== 'entreprise' && role !== 'secretaire') return;

      // Les étapes déjà accomplies sont cochées : présenter « Vérifiez votre
      // identité » à quelqu'un dont le KYC est validé décrédibilise le guide.
      const [{ data: kyc }, { data: tfa }] = await Promise.all([
        supabase.from('kyc_verifications').select('statut').eq('user_id', session.user.id).maybeSingle(),
        supabase.from('two_factor_auth').select('enabled').eq('user_id', session.user.id).maybeSingle(),
      ]);

      if (cancelled) return;

      const accomplies = new Set<string>();
      if (kyc?.statut === 'approved') accomplies.add('kyc');
      if (tfa?.enabled) accomplies.add('securite');

      const parcours = PARCOURS[role];
      // On ouvre sur la première étape restant à faire.
      const premiereRestante = parcours.findIndex(s => !accomplies.has(s.key));

      setSteps(parcours);
      setDone(accomplies);
      setCurrentStep(premiereRestante === -1 ? 0 : premiereRestante);
      setVisible(true);
    };

    const timer = setTimeout(check, 1200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pathname]);

  /** Masque le guide jusqu'à la prochaine session, sans le désactiver. */
  const snooze = useCallback(() => {
    setVisible(false);
    try {
      sessionStorage.setItem(SNOOZE_KEY, '1');
    } catch {
      /* stockage indisponible : le guide réapparaîtra, sans gravité */
    }
  }, []);

  /** Désactive définitivement le guide pour ce compte. */
  const terminer = useCallback(async () => {
    setVisible(false);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await supabase
      .from('profils')
      .update({ onboarding_completed: true })
      .eq('id', session.user.id);
  }, []);

  useEscapeKey(visible, snooze);

  if (!visible || steps.length === 0) return null;

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const estDerniere = currentStep === steps.length - 1;

  const allerAEtape = () => {
    // Report plutôt qu'achèvement : l'ancienne version marquait le guide
    // terminé dès qu'on suivait un lien, si bien que les étapes suivantes
    // n'étaient jamais montrées.
    snooze();
    router.push(step.href);
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      onClick={snooze}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-[fadeInZoom_0.2s_ease-out]" />
      <div
        className="relative bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-[slideUp_0.3s_cubic-bezier(0.22,1,0.36,1)] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Prise en main de SecrétariatPro"
      >
        <div className="h-1.5 bg-slate-100">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-500 ease-out rounded-r-full"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="px-6 sm:px-8 pt-8 pb-6 text-center">
          <p className="text-[11px] font-black uppercase tracking-widest text-blue-600 mb-3">
            Étape {currentStep + 1} sur {steps.length}
          </p>
          <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${step.color} text-white flex items-center justify-center mb-5 shadow-lg`}>
            {step.icon}
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">{step.title}</h2>
          <p className="text-sm text-slate-500 font-medium leading-relaxed">{step.description}</p>
        </div>

        <div className="px-6 sm:px-8 pb-6">
          <div className="space-y-2">
            {steps.map((s, i) => {
              const accomplie = done.has(s.key);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setCurrentStep(i)}
                  className={`flex w-full items-center gap-3 p-3 rounded-xl text-left transition-all duration-300 ${
                    i === currentStep
                      ? 'bg-slate-50 ring-1 ring-slate-200 shadow-sm'
                      : accomplie
                        ? 'bg-emerald-50/60'
                        : 'hover:bg-slate-50'
                  }`}
                >
                  <span
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${
                      accomplie
                        ? 'bg-emerald-100 text-emerald-600'
                        : i === currentStep
                          ? `${s.bgLight} text-slate-700`
                          : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {accomplie ? (
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <span className="text-xs font-bold">{i + 1}</span>
                    )}
                  </span>
                  <span className={`text-sm font-semibold ${i === currentStep ? 'text-slate-900' : 'text-slate-500'}`}>
                    {s.title}
                  </span>
                  {accomplie && (
                    <span className="ml-auto text-[10px] font-black uppercase tracking-wide text-emerald-600">
                      Fait
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="px-6 sm:px-8 pb-6 flex flex-col gap-2 sm:flex-row">
          <button
            onClick={allerAEtape}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all duration-200 active:scale-95"
          >
            {done.has(step.key) ? 'Revoir cette étape' : 'Commencer'}
          </button>
          {!estDerniere && (
            <button
              onClick={() => setCurrentStep(prev => Math.min(prev + 1, steps.length - 1))}
              className="flex-1 py-3 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all duration-200 active:scale-95"
            >
              Étape suivante
            </button>
          )}
        </div>

        <div className="px-6 sm:px-8 pb-6 flex flex-col items-center gap-1.5 border-t border-slate-100 pt-4">
          <button
            onClick={snooze}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 transition"
          >
            Plus tard
          </button>
          <button
            onClick={terminer}
            className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition"
          >
            Ne plus afficher ce guide
          </button>
        </div>
      </div>
    </div>
  );
}
