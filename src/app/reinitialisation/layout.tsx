import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Réinitialisation du mot de passe',
  description: 'Choisissez un nouveau mot de passe pour votre compte SecrétariatPro.',
  robots: { index: false, follow: true },
};

export default function ReinitialisationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
