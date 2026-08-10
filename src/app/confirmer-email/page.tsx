'use client';

import { useSearchParams } from 'next/navigation';
import Link from '@/components/Link';
import { Suspense } from 'react';

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const status = searchParams.get('status');

  const messages: Record<string, { icon: string; title: string; text: string; color: string }> = {
    success: {
      icon: '✅',
      title: 'Email confirmé !',
      text: 'Votre compte a été activé. Vous pouvez maintenant vous connecter.',
      color: 'text-green-700',
    },
    invalid: {
      icon: '❌',
      title: 'Lien invalide',
      text: 'Ce lien de confirmation n\'est pas valide.',
      color: 'text-red-700',
    },
    expired: {
      icon: '⏰',
      title: 'Lien expiré',
      text: 'Ce lien de confirmation a expiré. Demandez un nouveau lien.',
      color: 'text-orange-700',
    },
    pending: {
      icon: '📧',
      title: 'Vérifiez votre email',
      text: 'Un email de confirmation vous a été envoyé. Vérifiez votre boîte de réception et cliquez sur le lien pour activer votre compte.',
      color: 'text-blue-700',
    },
  };

  const msg = messages[status || ''] || {
    icon: '📧',
    title: 'Vérifiez votre email',
    text: 'Un email de confirmation vous a été envoyé. Vérifiez votre boîte de réception et cliquez sur le lien.',
    color: 'text-blue-700',
  };

  return (
    <main className="min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-blue-50/40 font-sans antialiased">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <Link href="/" className="inline-flex flex-col items-center hover:opacity-90 transition">
          <img src="/logo.png" alt="Logo SecrétariatPro" width={72} height={72} className="rounded-2xl mb-3 object-contain shadow-lg shadow-blue-100" />
          <span className="text-2xl font-black tracking-tight text-slate-900">
            Secrétariat<span className="text-blue-600">Pro</span>
          </span>
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-12 px-8 sm:px-10 rounded-3xl border border-slate-100 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-blue-50 flex items-center justify-center">
            <span className="text-4xl">{msg.icon}</span>
          </div>
          <h2 className={`text-2xl font-black tracking-tight mb-4 ${msg.color}`}>{msg.title}</h2>
          <p className="text-slate-600 font-medium leading-relaxed mb-8">{msg.text}</p>
          <div className="space-y-3">
            <Link href="/connexion" className="block w-full py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm tracking-tight transition shadow-lg shadow-blue-200">
              Retour à la connexion
            </Link>
            <Link href="/" className="block w-full py-3.5 rounded-full border-2 border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 font-bold text-sm transition">
              Retour à l&apos;accueil
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ConfirmerEmail() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>}>
      <ConfirmationContent />
    </Suspense>
  );
}
