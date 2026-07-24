'use client';

import { useEffect } from 'react';
import Link from '@/components/Link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-gray-900 p-4">
      <div className="text-center">
        <p className="text-8xl font-black text-blue-600 mb-4">404</p>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Page introuvable</h1>
        <p className="text-slate-500 dark:text-gray-400 mb-6">La page que vous cherchez n&apos;existe pas ou a été déplacée.</p>
        <Link href="/" className="inline-block bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition">Retour à l&apos;accueil</Link>
      </div>
    </div>
  );
}
