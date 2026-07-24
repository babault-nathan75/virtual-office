import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Connexion',
  description: 'Connectez-vous à votre espace SecrétariatPro. Accédez à vos missions, discussions et paramètres.',
  robots: { index: false, follow: true },
  alternates: { canonical: 'https://secretariatpro-drab.vercel.app/connexion' },
};

export default function ConnexionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
