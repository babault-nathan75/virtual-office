import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Confirmation email',
  description: 'Confirmez votre adresse email pour activer votre compte SecrétariatPro.',
  robots: { index: false, follow: true },
};

export default function ConfirmerEmailLayout({ children }: { children: React.ReactNode }) {
  return children;
}
