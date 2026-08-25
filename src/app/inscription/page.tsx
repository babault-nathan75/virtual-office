import AuthShell from '@/components/AuthShell';
import InscriptionForm from './InscriptionForm';
import { getTurnstileSiteKey } from '@/lib/turnstile';

/**
 * La page est désormais un composant serveur : seule la partie interactive
 * (`InscriptionForm`) part dans le bundle client. Le panneau de marque —
 * environ la moitié du balisage — est rendu côté serveur, ce qui accélère
 * l'affichage initial et améliore le LCP de la page d'inscription.
 */
export default function InscriptionPage() {
  return (
    <AuthShell
      brandTitle="Simplifiez votre gestion administrative dès aujourd'hui."
      brandSubtitle="Rejoignez l'écosystème qui connecte les entreprises exigeantes avec des secrétaires qualifiées."
      badge="Inscription gratuite"
      highlights={[
        { icon: 'check', label: 'Profils vérifiés par contrôle d\'identité' },
        { icon: 'bolt', label: 'Mise en relation instantanée' },
        { icon: 'lock', label: 'Espace sécurisé et conforme RGPD' },
      ]}
    >
      <InscriptionForm siteKey={getTurnstileSiteKey()} />
    </AuthShell>
  );
}
