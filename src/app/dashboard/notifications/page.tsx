'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { toast } from '@/components/Toast';
import { Button, Card, Breadcrumbs } from '@/components/ui';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { getPushState, registerPush, unregisterPush } from '@/lib/pushClient';

type Preferences = {
  messages: boolean;
  candidatures: boolean;
  offres: boolean;
  kyc: boolean;
  systeme: boolean;
};

const DEFAULT_PREFS: Preferences = {
  messages: true,
  candidatures: true,
  offres: true,
  kyc: true,
  systeme: true,
};

const PREFS_CONFIG: { key: keyof Preferences; label: string; description: string; icon: React.ReactNode }[] = [
  {
    key: 'messages',
    label: 'Nouveaux messages',
    description: 'Être notifié quand quelqu\'un vous envoie un message',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  },
  {
    key: 'candidatures',
    label: 'Candidatures',
    description: 'Quand une secrétaire postule à votre mission',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>,
  },
  {
    key: 'offres',
    label: 'Offres directes',
    description: 'Quand une entreprise vous fait une proposition',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  },
  {
    key: 'kyc',
    label: 'Vérification KYC',
    description: 'Statut de votre vérification d\'identité',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>,
  },
  {
    key: 'systeme',
    label: 'Notifications système',
    description: 'Mises à jour de la plateforme et annonces',
    icon: <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>,
  },
];

export default function NotificationPreferencesPage() {
  const router = useRouter();
  useDocumentTitle('Préférences de notification');
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState('');
  const [pushState, setPushState] = useState<Awaited<ReturnType<typeof getPushState>> | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        router.replace('/connexion');
        return;
      }

      setUserId(session.user.id);
      setPushState(await getPushState());

      try {
        const { data } = await supabase
          .from('profils')
          .select('notification_prefs')
          .eq('id', session.user.id)
          .maybeSingle();

        if (data?.notification_prefs && typeof data.notification_prefs === 'object') {
          setPrefs({ ...DEFAULT_PREFS, ...(data.notification_prefs as Partial<Preferences>) });
        }
      } catch {
        // column may not exist yet — use defaults
      }
      setLoading(false);
    };

    load();
  }, [router]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Sans ce traitement, le bouton restait bloqué sur « Sauvegarde… »
        // indéfiniment lorsque la session avait expiré.
        toast.error('Session expirée. Veuillez vous reconnecter.');
        router.replace('/connexion');
        return;
      }

      const { error } = await supabase
        .from('profils')
        .update({ notification_prefs: prefs })
        .eq('id', session.user.id);

      if (error) {
        if (error.message.includes('notification_prefs')) {
          toast.error('Colonne notification_prefs absente. Exécutez la migration 005.');
        } else {
          toast.error('Erreur : ' + error.message);
        }
      } else {
        toast.success('Préférences sauvegardées');
      }
    } finally {
      setSaving(false);
    }
  };

  // L'abonnement push n'était déclenché nulle part dans l'application : la
  // route /api/push/subscribe et les clés VAPID existaient sans qu'aucun
  // navigateur ne puisse s'inscrire. Il est ici explicitement demandé par
  // l'utilisateur, condition requise par les navigateurs.
  const handlePushToggle = async () => {
    setPushBusy(true);
    try {
      if (pushState === 'subscribed') {
        const done = await unregisterPush();
        if (done) {
          setPushState('available');
          toast.success('Notifications push désactivées sur cet appareil.');
        } else {
          toast.error('Impossible de se désabonner.');
        }
        return;
      }

      const result = await registerPush(userId);
      if (result.ok) {
        setPushState('subscribed');
        toast.success('Notifications push activées sur cet appareil.');
        return;
      }

      const messages: Record<string, string> = {
        unsupported: "Votre navigateur ne prend pas en charge les notifications push.",
        'not-configured': "Les notifications push ne sont pas configurées sur ce site.",
        denied: "Vous avez refusé les notifications. Autorisez-les dans les réglages de votre navigateur.",
        error: "L'activation a échoué. Réessayez plus tard.",
      };
      toast.error(messages[result.reason]);
      setPushState(await getPushState());
    } finally {
      setPushBusy(false);
    }
  };

  const PUSH_LABEL: Record<string, string> = {
    subscribed: 'Activées sur cet appareil',
    available: 'Désactivées sur cet appareil',
    denied: 'Bloquées par le navigateur',
    unsupported: 'Non prises en charge par ce navigateur',
    'not-configured': 'Non configurées sur ce site',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8 animate-[fadeSlideIn_0.3s_ease-out]">
        <div className="max-w-2xl mx-auto space-y-4">
          <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 flex items-center gap-4">
              <div className="w-10 h-10 bg-slate-200 rounded-xl animate-pulse" />
              <div className="flex-1 space-y-2"><div className="h-4 w-32 bg-slate-200 rounded animate-pulse" /><div className="h-3 w-48 bg-slate-200 rounded animate-pulse" /></div>
              <div className="w-12 h-6 bg-slate-200 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 animate-[fadeSlideIn_0.3s_ease-out]">
      <div className="max-w-2xl mx-auto">
        <Breadcrumbs items={[
          { label: 'Tableau de bord', href: '/dashboard' },
          { label: 'Notifications' },
        ]} />

        <h1 className="text-2xl font-black text-slate-900 mb-2">Préférences de notification</h1>
        <p className="text-sm text-slate-500 mb-6">Choisissez les notifications que vous souhaitez recevoir.</p>

        {/* Notifications push : réglage propre à l'appareil, distinct des
            préférences enregistrées sur le compte — d'où le bloc séparé. */}
        <Card className="mb-6 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-slate-900">Notifications push</p>
              <p className="text-xs text-slate-500">
                Recevez les alertes même quand l&apos;onglet est fermé.{' '}
                <span className="font-semibold text-slate-600">
                  {pushState ? PUSH_LABEL[pushState] : 'Vérification…'}
                </span>
              </p>
            </div>
            <Button
              onClick={handlePushToggle}
              loading={pushBusy}
              variant={pushState === 'subscribed' ? 'secondary' : 'primary'}
              disabled={pushState === 'unsupported' || pushState === 'not-configured' || pushState === 'denied'}
              className="w-full sm:w-auto"
            >
              {pushState === 'subscribed' ? 'Désactiver' : 'Activer'}
            </Button>
          </div>
        </Card>

        <Card className="divide-y divide-slate-100">
          {PREFS_CONFIG.map((pref) => (
            <div key={pref.key} className="flex items-center gap-4 p-5">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                {pref.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900">{pref.label}</p>
                <p className="text-xs text-slate-500">{pref.description}</p>
              </div>

              <div className="flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center justify-end">
                  <input
                    type="checkbox"
                    checked={prefs[pref.key]}
                    onChange={() => setPrefs(prev => ({ ...prev, [pref.key]: !prev[pref.key] }))}
                    aria-label={`Activer : ${pref.label}`}
                    className="peer sr-only"
                  />
                  <div
                    className={`relative h-5 w-9 rounded-full transition-colors duration-300 peer-focus:outline-none peer-focus:ring-4 ${
                      prefs[pref.key] ? 'bg-blue-600 peer-focus:ring-blue-100' : 'bg-slate-300 peer-focus:ring-slate-100'
                    } after:absolute after:start-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] ${
                      prefs[pref.key] ? 'peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full' : ''
                    }`}
                  />
                </label>
              </div>
            </div>
          ))}
        </Card>

        <div className="mt-6 flex justify-end">
          <Button onClick={handleSave} loading={saving}>
            Sauvegarder
          </Button>
        </div>
      </div>
    </div>
  );
}
