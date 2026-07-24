import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Mot de passe oublié',
  description: 'Réinitialisez votre mot de passe SecrétariatPro.',
  robots: { index: false, follow: true },
};

export default function MotDePasseOublieLayout({ children }: { children: React.ReactNode }) {
  return children;
}
