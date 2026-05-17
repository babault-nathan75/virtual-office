import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Politique de confidentialité — SecrétariatPro',
  description: 'Politique de confidentialité et traitement des données personnelles sur SecrétariatPro.',
};

export default function Confidentialite() {
  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 font-sans antialiased">
      <article className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-100 shadow-[0_15px_30px_rgba(0,0,0,0.03)] p-6 md:p-10">

        <Link href="/" className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 mb-6 transition">
          ← Accueil
        </Link>

        <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2">
          Politique de confidentialité
        </h1>
        <p className="text-sm text-slate-500 font-medium mb-8">Dernière mise à jour : à compléter</p>

        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-2xl p-4 mb-8 font-medium">
          ⚠️ Document modèle — à faire relire par un juriste avant publication officielle.
        </div>

        <section className="space-y-7 text-slate-700 leading-relaxed text-sm">

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">1. Responsable du traitement</h2>
            <p>
              Le responsable du traitement des données est l&apos;éditeur du site, dont les coordonnées figurent
              dans les{' '}
              <Link href="/mentions-legales" className="font-bold text-blue-600 hover:underline">Mentions légales</Link>.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">2. Données collectées</h2>
            <p>Nous collectons les données suivantes :</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><b>Données de compte :</b> nom, email, numéro de téléphone, mot de passe (chiffré).</li>
              <li><b>Données de profil (Secrétaire) :</b> photo, biographie, ville, compétences, outils,
                  années d&apos;expérience, niveau d&apos;études, disponibilité, langues parlées.</li>
              <li><b>Données d&apos;activité :</b> missions publiées, candidatures, offres proposées, notifications.</li>
              <li><b>Données techniques :</b> adresse IP, type d&apos;appareil, navigateur (logs serveur).</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">3. Finalités</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Permettre la mise en relation entre Entreprises et Secrétaires.</li>
              <li>Gérer les comptes utilisateurs et l&apos;authentification.</li>
              <li>Envoyer les notifications relatives à l&apos;activité (candidatures, offres, mises en relation).</li>
              <li>Assurer la sécurité de la Plateforme et prévenir les usages frauduleux.</li>
              <li>Améliorer le service (analyse statistique anonymisée).</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">4. Base légale</h2>
            <p>
              Les traitements reposent sur : (i) l&apos;exécution du contrat de service liant l&apos;utilisateur
              à la Plateforme, (ii) le consentement explicite lors de l&apos;inscription, et (iii) l&apos;intérêt
              légitime de la Plateforme pour la sécurité et la prévention des fraudes.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">5. Destinataires</h2>
            <p>Les données sont accessibles à :</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Les <b>administrateurs</b> de la Plateforme, pour gérer la mise en relation.</li>
              <li>Les autres utilisateurs, mais <b>uniquement</b> les informations publiques du profil (nom,
                  photo, compétences, etc.) — les coordonnées personnelles (téléphone, email)
                  <b> ne sont jamais exposées</b> aux autres utilisateurs.</li>
              <li>Nos sous-traitants techniques : <b>Supabase</b> (hébergement & base de données),
                  <b> Resend</b> (envoi des emails), <b>Vercel</b> (hébergement du site).</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">6. Durée de conservation</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Compte actif : tant que le compte n&apos;est pas supprimé.</li>
              <li>Compte supprimé : suppression complète sous 30 jours, sauf obligations légales (facturation : 10 ans).</li>
              <li>Logs techniques : 12 mois.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">7. Vos droits</h2>
            <p>Vous disposez à tout moment des droits suivants sur vos données :</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><b>Accès</b> — connaître les données que nous détenons sur vous.</li>
              <li><b>Rectification</b> — corriger des données inexactes (modifiable depuis votre profil).</li>
              <li><b>Suppression</b> — demander l&apos;effacement de votre compte et de vos données.</li>
              <li><b>Opposition</b> — refuser certains traitements.</li>
              <li><b>Portabilité</b> — recevoir vos données dans un format lisible.</li>
              <li><b>Retrait du consentement</b> à tout moment.</li>
            </ul>
            <p className="mt-3">
              Pour exercer vos droits, écrivez-nous à l&apos;adresse email indiquée dans les Mentions légales.
              Une réponse vous sera apportée sous 30 jours.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">8. Cookies</h2>
            <p>
              Le site utilise des cookies strictement nécessaires (authentification, session). Aucun cookie
              publicitaire ou de traçage tiers n&apos;est utilisé sans votre consentement explicite.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">9. Sécurité</h2>
            <p>
              Nous mettons en œuvre des mesures techniques et organisationnelles pour protéger vos données :
              chiffrement HTTPS, stockage chiffré, contrôle d&apos;accès strict (RLS), mots de passe hachés,
              isolation des coordonnées personnelles.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">10. Transferts internationaux</h2>
            <p>
              Certains de nos sous-traitants peuvent traiter les données hors de la Côte d&apos;Ivoire
              (notamment Supabase, Resend, Vercel). Ces transferts sont encadrés par des garanties contractuelles
              équivalentes aux standards internationaux de protection des données.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">11. Contact</h2>
            <p>
              Pour toute question relative à vos données personnelles, contactez-nous à l&apos;adresse email
              indiquée dans les{' '}
              <Link href="/mentions-legales" className="font-bold text-blue-600 hover:underline">Mentions légales</Link>.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">12. Modifications</h2>
            <p>
              Cette politique peut être mise à jour. Les modifications substantielles vous seront notifiées
              par email ou via la Plateforme.
            </p>
          </div>

        </section>

        <div className="mt-10 pt-6 border-t border-slate-100 flex gap-4 flex-wrap text-xs font-bold text-slate-500">
          <Link href="/mentions-legales" className="hover:text-blue-700">Mentions légales</Link>
          <Link href="/cgu" className="hover:text-blue-700">Conditions générales</Link>
        </div>
      </article>
    </main>
  );
}
