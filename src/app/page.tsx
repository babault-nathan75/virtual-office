import Link from '@/components/Link';
import Image from 'next/image';
import HeroCTA from '@/components/HeroCTA';
import { FAQJsonLd, OrganizationJsonLd, WebSiteJsonLd } from '@/components/JsonLd';
import type { Metadata } from 'next';
import { OG_LOCALE } from '@/lib/i18n';
import { getSiteUrl } from '@/lib/env';

export const metadata: Metadata = {
  title: 'SecrétariatPro - Secrétaire en ligne pour entreprise',
  description: 'Plateforme de mise en relation entre entreprises et secrétaires qualifiées. Trouvez une secrétaire freelance, publiez vos missions et collaborsez en toute sécurité.',
  openGraph: {
    title: 'SecrétariatPro - Secrétaire en ligne pour entreprise',
    description: 'Trouvez la secrétaire idéale ou publiez vos missions en quelques clics. Flexible, sans engagement.',
    url: getSiteUrl(),
    siteName: 'SecrétariatPro',
    locale: OG_LOCALE,
    type: 'website',
    images: [{ url: '/logo.png', width: 1200, height: 630, alt: 'SecrétariatPro' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SecrétariatPro - Secrétaire en ligne',
    description: 'Mise en relation entreprises et secrétaires qualifiées. Flexible, sécurisé, sans engagement.',
  },
  alternates: { canonical: 'https://secretariatpro-drab.vercel.app' },
};

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center font-sans antialiased selection:bg-blue-500 selection:text-white">
      {/* Organization et WebSite décrivent le site entier ; ils vivent sur la
          page d'accueil, sa page canonique. Les laisser dans le layout racine
          les injectait aussi dans le tableau de bord — pages en `noindex`, et
          désormais servies sous un CSP à nonce qui bloque tout script en ligne
          non signé, y compris un bloc `application/ld+json`. */}
      <OrganizationJsonLd />
      <WebSiteJsonLd />
      <FAQJsonLd />

      {/* HERO SECTION */}
      <section className="w-full relative py-36 px-4 text-center overflow-hidden flex items-center justify-center min-h-[85vh]">
        {/* Image d'arrière-plan avec traitement colorimétrique professionnel */}
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/secretaire_background.jpg"
            alt="Secrétaire dynamique avec documents"
            fill
            priority
            className="object-cover object-center scale-105 animate-[subtle-zoom_20s_ease-out_infinite]"
          />
          {/* Double dégradé pour fusionner parfaitement l'image et le texte */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-blue-950/40"></div>
          <div className="absolute inset-0 bg-blue-950/30 backdrop-blur-[1px]"></div>
        </div>

        <div className="max-w-5xl mx-auto relative z-10 text-white flex flex-col items-center">
          <span className="bg-gradient-to-r from-blue-500/20 to-indigo-500/20 border border-blue-400/30 text-blue-200 px-4 py-2 rounded-full text-xs font-bold tracking-widest uppercase mb-8 inline-block backdrop-blur-md shadow-sm">
            La 1ère plateforme de secrétariat en ligne
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

      {/* HOW IT WORKS SECTION */}
      <section id="comment-ca-marche" className="w-full max-w-6xl mx-auto py-24 px-4 -mt-20 relative z-20">
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
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center transition-colors group-hover:bg-blue-600 group-hover:text-white">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base mb-1 tracking-tight">Publiez votre besoin</h4>
                      <p className="text-slate-600 text-sm leading-relaxed font-medium">Décrivez précisément vos tâches (saisie, gestion d&apos;appels, mails) et la durée estimée.</p>
                    </div>
                  </li>
                  <li className="flex gap-5 group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center transition-colors group-hover:bg-blue-600 group-hover:text-white">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base mb-1 tracking-tight">Recevez des candidatures</h4>
                      <p className="text-slate-600 text-sm leading-relaxed font-medium">Consultez en temps réel les profils, portfolios et tarifs des secrétaires disponibles.</p>
                    </div>
                  </li>
                  <li className="flex gap-5 group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center transition-colors group-hover:bg-blue-600 group-hover:text-white">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </div>
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
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base mb-1 tracking-tight">Créez votre vitrine</h4>
                      <p className="text-slate-600 text-sm leading-relaxed font-medium">Mettez en valeur vos expertises métiers, vos expériences passées et fixez vos tarifs.</p>
                    </div>
                  </li>
                  <li className="flex gap-5 group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-900 text-base mb-1 tracking-tight">Trouvez des missions de choix</h4>
                      <p className="text-slate-600 text-sm leading-relaxed font-medium">Parcourez les demandes des entreprises et postulez instantanément aux offres.</p>
                    </div>
                  </li>
                  <li className="flex gap-5 group">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center transition-colors group-hover:bg-emerald-600 group-hover:text-white">
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
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

      {/* ADVANTAGES SECTION */}
      <section id="avantages" className="w-full bg-gradient-to-b from-slate-50 to-blue-50/40 py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight mb-4">
              Pourquoi choisir notre plateforme ?
            </h2>
            <p className="text-slate-500 font-medium text-base max-w-md mx-auto">
              L&apos;excellence administrative sans les contraintes traditionnelles.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 stagger-children">
            <div className="bg-white p-8 rounded-2xl shadow-[0_15px_30px_rgba(0,0,0,0.02)] border border-slate-100 card-hover">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-3">Flexibilité absolue</h3>
              <p className="text-slate-600 text-sm font-medium leading-relaxed">À la tâche, à la semaine ou au mois. Adaptez instantanément vos ressources à vos pics d&apos;activité.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-[0_15px_30px_rgba(0,0,0,0.02)] border border-slate-100 card-hover">
              <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-3">Sécurité & Confidentialité</h3>
              <p className="text-slate-600 text-sm font-medium leading-relaxed">Les données et coordonnées restent chiffrées et protégées jusqu&apos;à validation bilatérale du contrat.</p>
            </div>
            <div className="bg-white p-8 rounded-2xl shadow-[0_15px_30px_rgba(0,0,0,0.02)] border border-slate-100 card-hover">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
                <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <h3 className="text-xl font-extrabold text-slate-900 tracking-tight mb-3">Zéro charges fixes</h3>
              <p className="text-slate-600 text-sm font-medium leading-relaxed">Oubliez la complexité juridique des embauches. Payez exclusivement le travail opérationnel accompli.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
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
