'use client';

import { Suspense } from 'react';

function DefaultFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

export function StreamSection({ children, fallback }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <Suspense fallback={fallback || <DefaultFallback />}>
      {children}
    </Suspense>
  );
}

export function StreamCard({ title, children, fallback }: { title?: string; children: React.ReactNode; fallback?: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-slate-100 dark:border-gray-700 shadow-sm overflow-hidden">
      {title && (
        <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-700">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm">{title}</h3>
        </div>
      )}
      <Suspense fallback={fallback || <DefaultFallback />}>
        <div className="p-6">{children}</div>
      </Suspense>
    </div>
  );
}
