'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Connexion() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // 1. Tentative de connexion via Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setErrorMsg(authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      // 2. On va chercher le rôle de l'utilisateur dans la table profils
      const { data: profilData, error: profilError } = await supabase
        .from('profils')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      if (profilError) {
        setErrorMsg("Erreur lors de la récupération du profil.");
        setLoading(false);
        return;
      }

      // 3. 🚀 Redirection Intelligente selon le rôle (Admin ajouté !)
      if (profilData.role === 'entreprise') {
        router.push('/dashboard/entreprise');
      } else if (profilData.role === 'secretaire') {
        router.push('/dashboard/secretaire');
      } else if (profilData.role === 'admin') {
        router.push('/dashboard/admin');
      } else {
        router.push('/'); // Sécurité par défaut
      }
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <Link href="/" className="text-3xl font-extrabold text-blue-900 hover:text-blue-700 transition">
          Secrétariat<span className="text-blue-500">Pro</span>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Bon retour !
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Connectez-vous à votre espace personnel.
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border border-gray-100">
          
          {errorMsg && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm text-center">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="votre@email.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <input 
                type="password" 
                required 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="••••••••"
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 text-white font-bold py-3.5 rounded-lg hover:bg-blue-700 transition shadow-md disabled:bg-blue-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Connexion en cours...' : "Se connecter"}
            </button>
          </form>

          <div className="mt-6 border-t border-gray-100 pt-6 text-center">
            <p className="text-sm text-gray-600">
              Pas encore de compte ?{' '}
              <Link href="/inscription" className="font-semibold text-blue-600 hover:text-blue-500 hover:underline">
                S'inscrire
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}