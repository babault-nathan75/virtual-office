'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function Inscription() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState(''); // 📞 Nouveau state pour le contact
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // 🔒 Nouveau state pour la confirmation
  const [nom, setNom] = useState('');
  const [role, setRole] = useState<'entreprise' | 'secretaire'>('entreprise');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    // 🛑 1. Vérification : Les mots de passe sont-ils identiques ?
    if (password !== confirmPassword) {
      setMessage({ text: "Les mots de passe ne correspondent pas.", type: 'error' });
      setLoading(false);
      return; // On arrête l'exécution ici si ça ne matche pas
    }

    // 🚀 2. Inscription via Supabase Auth
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          nom: nom,
          role: role,
          telephone: telephone, // 📞 On envoie la variable telephone ici !
        },
      },
    });

    if (error) {
      setMessage({ text: error.message, type: 'error' });
    } else {
      setMessage({ 
        text: '🎉 Inscription réussie ! Vous pouvez maintenant vous connecter.', 
        type: 'success' 
      });
      setTimeout(() => router.push('/connexion'), 2000);
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8">
        <Link href="/" className="text-3xl font-extrabold text-blue-900 hover:text-blue-700 transition">
          Secrétariat<span className="text-blue-500">Pro</span>
        </Link>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Créer un compte
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Rejoignez notre plateforme en quelques secondes.
        </p>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl sm:rounded-xl sm:px-10 border border-gray-100">
          
          {message.text && (
            <div className={`mb-6 p-4 rounded-lg text-sm font-medium text-center ${
              message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleSignUp} className="space-y-5">
            
            {/* 🎯 SÉLECTION DU RÔLE */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3 text-center">
                Quel est votre objectif ?
              </label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setRole('entreprise')}
                  className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                    role === 'entreprise' 
                      ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-sm' 
                      : 'border-gray-200 text-gray-500 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-2xl mb-1">🏢</span>
                  <span className="font-bold text-sm">Recruter</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRole('secretaire')}
                  className={`flex-1 flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                    role === 'secretaire' 
                      ? 'border-green-600 bg-green-50 text-green-800 shadow-sm' 
                      : 'border-gray-200 text-gray-500 hover:border-green-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-2xl mb-1">👩‍💻</span>
                  <span className="font-bold text-sm">Travailler</span>
                </button>
              </div>
            </div>

            {/* 📝 CHAMP NOM */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {role === 'entreprise' ? 'Nom de l\'entreprise ou du gérant' : 'Prénom et Nom'}
              </label>
              <input 
                type="text" 
                required 
                value={nom} 
                onChange={(e) => setNom(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder={role === 'entreprise' ? 'Ex: Tech Solutions' : 'Ex: Marie Dupont'}
              />
            </div>

            {/* 📝 NOUVEAU : CHAMP CONTACT (TÉLÉPHONE) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Numéro de Téléphone</label>
              <input 
                type="tel" 
                required 
                value={telephone} 
                onChange={(e) => setTelephone(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="Ex: +225 01 02 03 04 05"
              />
            </div>

            {/* 📝 CHAMP EMAIL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Adresse Email</label>
              <input 
                type="email" 
                required 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                placeholder="votre@email.com"
              />
            </div>

            {/* 🔒 LES DEUX CHAMPS MOT DE PASSE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                <input 
                  type="password" 
                  required 
                  minLength={6} // Sécurité basique
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer</label>
                <input 
                  type="password" 
                  required 
                  value={confirmPassword} 
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full border rounded-lg p-2.5 outline-none focus:ring-2 transition ${
                    confirmPassword && password !== confirmPassword 
                      ? 'border-red-300 focus:ring-red-500 bg-red-50' // Visuel rouge si erreur
                      : 'border-gray-300 focus:ring-blue-500 focus:border-transparent'
                  }`}
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* 🚀 BOUTON DE SOUMISSION DYNAMIQUE */}
            <button 
              type="submit" 
              disabled={loading || (confirmPassword !== '' && password !== confirmPassword)}
              className={`w-full text-white font-bold py-3.5 mt-2 rounded-lg transition shadow-md disabled:opacity-70 disabled:cursor-not-allowed ${
                role === 'entreprise' 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {loading 
                ? 'Création en cours...' 
                : role === 'entreprise' 
                  ? 'Créer mon compte Entreprise' 
                  : 'Créer mon compte Secrétaire'
              }
            </button>
          </form>

          {/* 🔗 LIEN VERS CONNEXION */}
          <div className="mt-6 border-t border-gray-100 pt-6 text-center">
            <p className="text-sm text-gray-600">
              Vous avez déjà un compte ?{' '}
              <Link href="/connexion" className="font-semibold text-blue-600 hover:text-blue-500 hover:underline">
                Connectez-vous ici
              </Link>
            </p>
          </div>

        </div>
      </div>
    </main>
  );
}