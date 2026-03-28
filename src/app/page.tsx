import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 flex flex-col items-center">
      
      {/* 🌟 SECTION HERO (L'accroche principale) */}
      <section className="w-full bg-gradient-to-br from-blue-900 to-blue-700 text-white py-24 px-4 text-center">
        <div className="max-w-5xl mx-auto">
          <span className="bg-blue-800 text-blue-100 px-4 py-1.5 rounded-full text-sm font-semibold tracking-wide uppercase mb-6 inline-block">
            La 1ère plateforme de secrétariat en ligne
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight">
            Déléguez votre administratif. <br className="hidden md:block" />
            <span className="text-blue-300">Boostez votre productivité.</span>
          </h1>
          <p className="text-xl mb-10 text-blue-100 max-w-3xl mx-auto">
            Mise en relation sécurisée entre entreprises exigeantes et secrétaires qualifié(e)s. 
            Flexible, sans engagement de recrutement, et adapté à votre budget.
          </p>
          
          {/* Les deux boutons d'action (Double Call-to-Action) */}
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              href="/inscription" 
              className="bg-white text-blue-800 font-bold py-4 px-8 rounded-lg shadow-lg hover:bg-gray-100 hover:scale-105 transition transform"
            >
              🏢 Je cherche une secrétaire
            </Link>
            <Link 
              href="/inscription" 
              className="bg-green-500 text-white font-bold py-4 px-8 rounded-lg shadow-lg hover:bg-green-400 hover:scale-105 transition transform"
            >
              👩‍💻 Je propose mes services
            </Link>
          </div>
        </div>
      </section>

      {/* 🔄 SECTION COMMENT ÇA MARCHE (Séparée en 2 colonnes) */}
      <section className="w-full max-w-6xl mx-auto py-20 px-4">
        <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-800 mb-16">
          Une collaboration simple et rapide
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          
          {/* Bloc Entreprise */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border-t-4 border-blue-600">
            <h3 className="text-2xl font-bold text-blue-800 mb-6 flex items-center gap-3">
              <span className="bg-blue-100 text-blue-600 w-10 h-10 flex items-center justify-center rounded-full">1</span>
              Pour les Entreprises
            </h3>
            <ul className="space-y-6">
              <li className="flex items-start gap-4">
                <span className="text-2xl">📝</span>
                <div>
                  <h4 className="font-bold text-gray-800">Publiez votre besoin</h4>
                  <p className="text-gray-600 text-sm">Décrivez les tâches (saisie, appels, mails) et la durée.</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <span className="text-2xl">📬</span>
                <div>
                  <h4 className="font-bold text-gray-800">Recevez des candidatures</h4>
                  <p className="text-gray-600 text-sm">Consultez les profils et les tarifs des secrétaires intéressé(e)s.</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <span className="text-2xl">🤝</span>
                <div>
                  <h4 className="font-bold text-gray-800">Validez et travaillez</h4>
                  <p className="text-gray-600 text-sm">Acceptez le meilleur profil, nous organisons la mise en relation sécurisée.</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Bloc Secrétaire */}
          <div className="bg-white p-8 rounded-2xl shadow-sm border-t-4 border-green-500">
            <h3 className="text-2xl font-bold text-green-700 mb-6 flex items-center gap-3">
              <span className="bg-green-100 text-green-600 w-10 h-10 flex items-center justify-center rounded-full">2</span>
              Pour les Secrétaires
            </h3>
            <ul className="space-y-6">
              <li className="flex items-start gap-4">
                <span className="text-2xl">👤</span>
                <div>
                  <h4 className="font-bold text-gray-800">Créez votre profil</h4>
                  <p className="text-gray-600 text-sm">Mettez en avant vos compétences, votre expérience et votre tarif.</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <span className="text-2xl">🔍</span>
                <div>
                  <h4 className="font-bold text-gray-800">Trouvez des missions</h4>
                  <p className="text-gray-600 text-sm">Parcourez les offres des entreprises et postulez en un clic.</p>
                </div>
              </li>
              <li className="flex items-start gap-4">
                <span className="text-2xl">💰</span>
                <div>
                  <h4 className="font-bold text-gray-800">Décrochez des contrats</h4>
                  <p className="text-gray-600 text-sm">Une fois accepté(e), l'entreprise vous contacte pour démarrer.</p>
                </div>
              </li>
            </ul>
          </div>

        </div>
      </section>

      {/* 🛡️ SECTION AVANTAGES */}
      <section className="w-full bg-blue-50 py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-800 mb-12">
            Pourquoi utiliser notre plateforme ?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="text-4xl mb-4">⏱️</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Flexibilité totale</h3>
              <p className="text-gray-600">À la tâche, à la semaine ou au mois. Adaptez vos charges à votre activité réelle.</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="text-4xl mb-4">🔒</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Confidentialité garantie</h3>
              <p className="text-gray-600">Les coordonnées sont protégées jusqu'à la validation finale de la mission.</p>
            </div>
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <div className="text-4xl mb-4">💼</div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Sans charges fixes</h3>
              <p className="text-gray-600">Évitez les lourdeurs du recrutement classique. Payez uniquement pour le travail effectué.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 🚀 BANNIÈRE FINALE (Footer CTA) */}
      <section className="w-full bg-gray-900 text-white py-16 px-4 text-center">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold mb-6">Prêt à simplifier votre quotidien ?</h2>
          <p className="text-gray-400 mb-8">
            Rejoignez des dizaines d'entreprises et de freelances qui font déjà confiance à notre plateforme.
          </p>
          <Link 
            href="/inscription" 
            className="inline-block bg-blue-600 text-white font-bold py-3 px-8 rounded-lg shadow hover:bg-blue-500 transition"
          >
            Créer un compte gratuitement
          </Link>
          <div className="mt-8 text-sm text-gray-500">
            <Link href="/connexion" className="hover:text-white underline">Déjà inscrit ? Connectez-vous ici.</Link>
          </div>
        </div>
      </section>

    </main>
  );
}