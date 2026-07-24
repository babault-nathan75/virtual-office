import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Inscription gratuite',
  description: 'Créez votre compte SecrétariatPro gratuitement. Entreprises : trouvez une secrétaire. Secrétaires : trouvez des missions.',
  openGraph: {
    title: 'Inscription gratuite - SecrétariatPro',
    description: 'Rejoignez la plateforme de mise en relation entre entreprises et secrétaires qualifiées.',
  },
  alternates: { canonical: 'https://secretariatpro-drab.vercel.app/inscription' },
};

export default function InscriptionLayout({ children }: { children: React.ReactNode }) {
  return children;
}
