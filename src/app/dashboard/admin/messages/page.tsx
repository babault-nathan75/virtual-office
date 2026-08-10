'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { supabase } from '@/lib/supabaseClient';
import ChatWindow from '@/components/ChatWindow';

export default function AdminMessagesPage() {
  const router = useRouter();

  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Vérification de la session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (!session) {
          router.replace('/connexion');
          return;
        }

        // 2. Vérification du rôle
        const { data: profil, error: profilError } = await supabase
          .from('profils')
          .select('role')
          .eq('id', session.user.id)
          .maybeSingle();

        if (profilError) {
          throw profilError;
        }

        if (!profil || profil.role !== 'admin') {
          router.replace('/dashboard');
          return;
        }

        // 3. Initialisation de l'utilisateur
        if (mounted) {
          setUserId(session.user.id);
        }
      } catch (err) {
        console.error(
          'Erreur lors du chargement de la messagerie admin :',
          err
        );

        if (mounted) {
          setError(
            "Impossible de charger la messagerie pour le moment. Veuillez réessayer."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      mounted = false;
    };
  }, [router]);

  // État de chargement
  if (loading) {
    return <AdminMessagesSkeleton />;
  }

  // État d'erreur
  if (error) {
    return (
      <main className="min-h-screen bg-slate-50">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-7 w-7"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5" />
                <path d="M12 16.5h.01" />
              </svg>
            </div>

            <h1 className="text-xl font-bold text-slate-900">
              Une erreur est survenue
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              {error}
            </p>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
            >
              Réessayer
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 py-5 sm:px-6 lg:px-8">
        {/* Navigation */}
        <div className="mb-5">
          <Link
            href="/admin"
            className="group inline-flex items-center gap-2 rounded-xl px-1 py-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white shadow-sm transition group-hover:border-slate-300 group-hover:bg-slate-50">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </span>

            Console d&apos;administration
          </Link>
        </div>

        {/* En-tête */}
        <header className="mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Messagerie
                </span>
              </div>

              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                Discussions
              </h1>

              <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-500 sm:text-base">
                Centralisez et gérez les conversations avec les entreprises et
                les secrétaires depuis votre espace d&apos;administration.
              </p>
            </div>

            <div className="hidden items-center gap-3 lg:flex">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Espace
                </p>

                <p className="mt-0.5 text-sm font-semibold text-slate-800">
                  Administration
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Zone de messagerie */}
        <section className="min-h-0 flex-1">
          <div className="relative h-[calc(100vh-230px)] min-h-[600px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
            {/* Barre supérieure */}
            <div className="flex h-16 items-center justify-between border-b border-slate-100 bg-white px-5 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className="h-5 w-5"
                    aria-hidden="true"
                  >
                    <path d="M8 10h8" />
                    <path d="M8 14h5" />
                    <path d="M21 12a8 8 0 0 1-8 8H7l-4 2 1.5-4A8 8 0 1 1 21 12Z" />
                  </svg>
                </div>

                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    Centre de messages
                  </h2>

                  <p className="text-xs text-slate-500">
                    Entreprises & secrétaires
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs font-semibold text-emerald-700">
                  En ligne
                </span>
              </div>
            </div>

            {/* Chat */}
            <div className="h-[calc(100%-4rem)]">
              <ChatWindow
                currentUserId={userId}
                currentRole="admin"
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function AdminMessagesSkeleton() {
  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        {/* Retour */}
        <div className="mb-7 h-10 w-52 animate-pulse rounded-xl bg-slate-200" />

        {/* Header */}
        <div className="mb-7">
          <div className="mb-3 h-6 w-28 animate-pulse rounded-full bg-slate-200" />
          <div className="h-10 w-56 animate-pulse rounded-xl bg-slate-200" />
          <div className="mt-3 h-5 w-full max-w-xl animate-pulse rounded-lg bg-slate-200" />
        </div>

        {/* Chat skeleton */}
        <div className="h-[calc(100vh-230px)] min-h-[600px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex h-16 items-center border-b border-slate-100 px-6">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200" />

            <div className="ml-3">
              <div className="h-4 w-36 animate-pulse rounded bg-slate-200" />
              <div className="mt-2 h-3 w-24 animate-pulse rounded bg-slate-100" />
            </div>
          </div>

          <div className="grid h-[calc(100%-4rem)] grid-cols-1 md:grid-cols-[340px_1fr]">
            <div className="hidden border-r border-slate-100 p-4 md:block">
              {[1, 2, 3, 4, 5].map((item) => (
                <div
                  key={item}
                  className="mb-3 flex items-center gap-3 rounded-2xl p-3"
                >
                  <div className="h-11 w-11 animate-pulse rounded-full bg-slate-200" />

                  <div className="flex-1">
                    <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                    <div className="mt-2 h-3 w-44 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center p-6">
              <div className="text-center">
                <div className="mx-auto h-14 w-14 animate-pulse rounded-2xl bg-slate-200" />
                <div className="mx-auto mt-4 h-5 w-44 animate-pulse rounded bg-slate-200" />
                <div className="mx-auto mt-2 h-4 w-64 animate-pulse rounded bg-slate-100" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}