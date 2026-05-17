import Link from 'next/link';
import HeroCTA from '@/components/HeroCTA';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center font-sans antialiased selection:bg-blue-500 selection:text-white">

      {/* 🌟 SECTION HERO – VISUEL IMPACTANT & TYPOGRAPHIE EMBLÉMATIQUE */}
      <section className="w-full relative py-36 px-4 text-center overflow-hidden flex items-center justify-center min-h-[85vh]">
        {/* Image d'arrière-plan avec traitement colorimétrique professionnel */}
        <div className="absolute inset-0 z-0">
          <img
            src="/images/secretaire_background.jpg"
            alt="Secrétaire dynamique avec documents"
            className="w-full h-full object-cover object-center scale-105 animate-[subtle-zoom_20s_ease-out_infinite]"
          />
          {/* Double dégradé pour fusionner parfaitement l'image et le texte */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-blue-950/40"></div>
          <div className="absolute inset-0 bg-blue-950/30 backdrop-blur-[1px]"></div>
        </div>

        <div className="max-w-5xl mx-auto relative z-10 text-white flex flex-col items-center">
          <span className="bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-400/30 text-blue-200 px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase mb-8 inline-block backdrop-blur-md shadow-sm">
            🚀 La 1ère plateforme de secrétariat en ligne
          </span>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight mb-8 leading-[1.1] text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
            Déléguez votre administratif.<br className="hidden md:block" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-300 via-cyan-200 to-indigo-200 block md:inline mt-2 md:mt-0">
              Boostez votre productivité.
            </span>
          </h1>

          <p className="text-lg md:text-xl font-medium mb-12 text-slate-200 max-w-3xl mx-auto leading-relaxed drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
            Mise en relation sécurisée entre entreprises exigeantes et secrétaires qualifié(e)s.
            Flexible, sans engagement, et parfaitement adapté à votre budget.
          </p>

          {/* Boutons d'action — adaptés au rôle de l'utilisateur s'il est connecté */}
          <HeroCTA />
        </div>
      </section>

      {/* 🔄 SECTION "COMMENT ÇA MARCHE" – DESIGN ÉPURÉ ETÉLÉGANT */}
      <section className="w-full max-w-6xl mx-auto py-24 px-4 -mt-20 relative z-20">
        <div className="bg-white/95 backdrop-blur-md p-8 md:p-16 rounded-3xl shadow-[0_30px_60px_-15px_rgba(0,0,0,0.08)] border border-slate-100">
          <h2 className="text-3xl md:text-4xl font-black text-center text-slate-900 tracking-tight mb-4">
            Une collaboration simple et rapide
          </h2>
          <p className="text-slate-500 text-center text-base font-medium max-w-xl mx-auto mb-16">
            Notre écosystème est pensé pour vous faire gagner du temps dès le premier jour.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16">

            {/* Colonne Entreprise */}
            <div className="relative p-2">
              <div className="absolute top-0 left-0 bg-blue-600/10 text-blue-700 w-12 h-12 flex items-center justify-center rounded-2xl text-lg font-black tracking-tight">
                01
              </div>
              <div className="pl-16">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-8">
                  Pour les Entreprises
                </h3>
                <ul className="space-y-8">
                  <li className="flex gap-5 group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-semibold transition-colors group-hover:bg-blue-600 group-hover:text-white">📝</div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base mb-1 tracking-tight">Publiez votre besoin</h4>
                      <p className="text-slate-600 text-sm leading-relaxed font-medium">Décrivez précisément vos tâches (saisie, gestion d'appels, mails) et la durée estimée.</p>
                    </div>
                  </li>
                  <li className="flex gap-5 group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-semibold transition-colors group-hover:bg-blue-600 group-hover:text-white">📬</div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base mb-1 tracking-tight">Recevez des candidatures</h4>
                      <p className="text-slate-600 text-sm leading-relaxed font-medium">Consultez en temps réel les profils, portfolios et tarifs des secrétaires disponibles.</p>
                    </div>
                  </li>
                  <li className="flex gap-5 group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-semibold transition-colors group-hover:bg-blue-600 group-hover:text-white">🤝</div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base mb-1 tracking-tight">Validez et travaillez</h4>
                      <p className="text-slate-600 text-sm leading-relaxed font-medium">Sélectionnez le profil idéal. Notre processus sécurise la contractualisation.</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

            {/* Colonne Secrétaire */}
            <div className="relative p-2 border-t lg:border-t-0 lg:border-l border-slate-100 pt-12 lg:pt-0 lg:pl-16">
              <div className="absolute top-12 lg:top-0 left-2 lg:left-16 bg-emerald-600/10 text-emerald-700 w-12 h-12 flex items-center justify-center rounded-2xl text-lg font-black tracking-tight">
                02
              </div>
              <div className="pl-16">
                <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-8">
                  Pour les Secrétaires
                </h3>
                <ul className="space-y-8">
                  <li className="flex gap-5 group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-semibold transition-colors group-hover:bg-emerald-600 group-hover:text-white">👤</div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base mb-1 tracking-tight">Créez votre vitrine</h4>
                      <p className="text-slate-600 text-sm leading-relaxed font-medium">Mettez en valeur vos expertises métiers, vos expériences passées et fixez vos tarifs.</p>
                    </div>
                  </li>
                  <li className="flex gap-5 group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-semibold transition-colors group-hover:bg-emerald-600 group-hover:text-white">🔍</div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base mb-1 tracking-tight">Trouvez des missions de choix</h4>
                      <p className="text-slate-600 text-sm leading-relaxed font-medium">Parcourez les demandes des entreprises et postulez instantanément aux offres.</p>
                    </div>
                  </li>
                  <li className="flex gap-5 group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl font-semibold transition-colors group-hover:bg-emerald-600 group-hover:text-white">💰</div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base mb-1 tracking-tight">Développez votre activité</h4>
                      <p className="text-slate-600 text-sm leading-relaxed font-medium">Une fois validée, collaborez directement et bénéficiez de paiements garantis.</p>
                    </div>
                  </li>
                </ul>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 🛡️ SECTION AVANTAGES – ESTHÉTIQUE ÉDITORIALE */}
      <section className="w-full bg-gradient-to-b from-slate-50 to-blue-50/40 py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-4">
              Pourquoi choisir notre plateforme ?
            </h2>
            <p className="text-slate-500 font-medium text-base max-w-md mx-auto">
              L'excellence administrative sans les contraintes traditionnelles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-[0_15px_30px_rgba(0,0,0,0.02)] border border-slate-100 hover:shadow-[0_20px_40px_rgba(0,0,0,0.05)] hover:-translate-y-1 transition-all duration-300">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-inner">⏱️</div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-3">Flexibilité absolue</h3>
              <p className="text-slate-600 text-sm font-medium leading-relaxed">À la tâche, à la semaine ou au mois. Adaptez instantanément vos ressources à vos pics d'activité.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-[0_15px_30px_rgba(0,0,0,0.02)] border border-slate-100 hover:shadow-[0_20px_40px_rgba(0,0,0,0.05)] hover:-translate-y-1 transition-all duration-300">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-inner">🔒</div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-3">Sécurité & Confidentialité</h3>
              <p className="text-slate-600 text-sm font-medium leading-relaxed">Les données et coordonnées restent chiffrées et protégées jusqu'à validation bilatérale du contrat.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-[0_15px_30px_rgba(0,0,0,0.02)] border border-slate-100 hover:shadow-[0_20px_40px_rgba(0,0,0,0.05)] hover:-translate-y-1 transition-all duration-300">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl mb-6 shadow-inner">💼</div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-3">Zéro charges fixes</h3>
              <p className="text-slate-600 text-sm font-medium leading-relaxed">Oubliez la complexité juridique des embauches. Payez exclusivement le travail opérationnel accompli.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 🚀 BANNIÈRE FINALE – APPEL À L'ACTION RADICAL */}
      <section className="w-full bg-slate-950 text-white py-24 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.1),transparent_40%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_40%)]"></div>

        <div className="max-w-3xl mx-auto relative z-10">
          <h2 className="text-3xl md:text-5xl font-black mb-6 tracking-tight leading-tight">
            Prêt à simplifier votre quotidien ?
          </h2>
          <p className="text-slate-400 font-medium text-lg mb-10 max-w-xl mx-auto">
            Rejoignez des centaines de dirigeants et de professionnels indépendants qui transforment leur gestion administrative.
          </p>
          <Link
            href="/inscription"
            className="inline-block bg-blue-600 text-white font-extrabold py-5 px-12 rounded-full shadow-[0_15px_30px_rgba(37,99,235,0.3)] hover:bg-blue-500 hover:scale-105 transition-all duration-300 text-base tracking-tight"
          >
            Créer mon compte gratuitement
          </Link>
          <div className="mt-8 text-sm text-slate-500 font-medium">
            <Link href="/connexion" className="hover:text-white transition-colors underline underline-offset-4">Déjà membre ? Connectez-vous ici</Link>
          </div>
        </div>
      </section>

    </main>
  );
}
