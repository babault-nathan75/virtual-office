import { Suspense } from 'react';
import AuthShell from '@/components/AuthShell';
import ConnexionForm from './ConnexionForm';
import { getTurnstileSiteKey } from '@/lib/turnstile';

export default function ConnexionPage() {
  return (
    <AuthShell
      brandTitle="Ravi de vous revoir sur votre espace dédié."
      brandSubtitle="Accédez à vos dossiers, à votre réseau de secrétaires et à vos outils de gestion administrative."
      highlights={[
        { icon: 'lock', label: 'Connexion chiffrée de bout en bout' },
        { icon: 'shield', label: 'Code à usage unique à chaque connexion' },
        { icon: 'check', label: 'Comptes vérifiés par contrôle d\'identité' },
      ]}
    >
      {/* `useSearchParams` impose une frontière Suspense : sans elle, la page
          entière bascule en rendu dynamique et perd le pré-rendu statique. */}
      <Suspense
        fallback={
          <div className="min-h-[320px] flex items-center justify-center" aria-busy="true">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        }
      >
        <ConnexionForm siteKey={getTurnstileSiteKey()} />
      </Suspense>
    </AuthShell>
  );
}
