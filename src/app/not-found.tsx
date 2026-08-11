'use client';

import Link from '@/components/Link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 animate-[fadeSlideIn_0.3s_ease-out]">
      <div className="text-center">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-blue-50 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
        </div>
        <p className="text-6xl font-black text-slate-900 mb-2">404</p>
        <h1 className="text-xl font-bold text-slate-900 mb-2">Page introuvable</h1>
        <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">La page que vous cherchez n&apos;existe pas ou a été déplacée.</p>
        <Link href="/" className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-sm">
          <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" /></svg>
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}
