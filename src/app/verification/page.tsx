import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import AuthShell from '@/components/AuthShell';
import VerificationForm from './VerificationForm';
import { getTurnstileSiteKey } from '@/lib/turnstile';
import { readChallengeCookie } from '@/lib/authChallenge';

export const metadata: Metadata = {
  title: 'Vérification',
  description: 'Saisissez le code de vérification reçu par email.',
  // Écran transactionnel : aucune valeur en recherche, et l'indexer exposerait
  // une adresse email dans les résultats via le paramètre d'URL.
  robots: { index: false, follow: false },
};

type Props = {
  searchParams: Promise<{ purpose?: string; email?: string }>;
};

export default async function VerificationPage({ searchParams }: Props) {
  const params = await searchParams;

  const requested =
    params.purpose === 'signup' ? 'signup' : params.purpose === 'login' ? 'login' : null;

  if (!requested) redirect('/connexion');

  // Pour une connexion, l'adresse et la méthode font autorité côté serveur :
  // elles proviennent du cookie de défi signé, jamais de l'URL, qu'un tiers
  // pourrait fabriquer.
  const challenge = requested === 'login' ? await readChallengeCookie() : null;

  if (requested === 'login' && !challenge) {
    redirect('/connexion');
  }

  const email = challenge?.email ?? params.email?.trim().toLowerCase() ?? '';
  const method = challenge?.method ?? 'email';

  if (!email) redirect('/connexion');

  const isTotp = method === 'totp';

  return (
    <AuthShell
      brandTitle={
        requested === 'signup'
          ? 'Une dernière étape avant de démarrer.'
          : 'Une vérification, et vous y êtes.'
      }
      brandSubtitle={
        requested === 'signup'
          ? "Nous vérifions votre adresse email pour protéger votre compte et garantir la fiabilité des profils de la plateforme."
          : "Un second facteur est demandé à chaque connexion : même volé, votre mot de passe ne suffit pas à accéder à votre espace."
      }
      badge={requested === 'signup' ? 'Vérification email' : 'Double authentification'}
      highlights={[
        {
          icon: isTotp ? 'shield' : 'mail',
          label: isTotp
            ? "Code généré par votre application d'authentification"
            : 'Code à usage unique envoyé par email',
        },
        {
          icon: 'lock',
          label: isTotp ? 'Renouvelé toutes les 30 secondes' : 'Valable 10 minutes, une seule utilisation',
        },
        { icon: 'shield', label: 'Protège votre compte même si votre mot de passe fuit' },
      ]}
    >
      <VerificationForm
        purpose={requested}
        method={method}
        email={email}
        siteKey={getTurnstileSiteKey()}
      />
    </AuthShell>
  );
}
