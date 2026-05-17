import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Conditions générales d\'utilisation — SecrétariatPro',
  description: 'Conditions générales d\'utilisation de la plateforme SecrétariatPro.',
};

export default function CGU() {
  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 font-sans antialiased">
      <article className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-100 shadow-[0_15px_30px_rgba(0,0,0,0.03)] p-6 md:p-10">

        <Link href="/" className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 mb-6 transition">
          ← Accueil
        </Link>

        <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2">
          Conditions générales d&apos;utilisation
        </h1>
        <p className="text-sm text-slate-500 font-medium mb-8">Dernière mise à jour : à compléter</p>

        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-2xl p-4 mb-8 font-medium">
          ⚠️ Document modèle — à faire relire et adapter par un juriste avant publication officielle.
        </div>

        <section className="space-y-7 text-slate-700 leading-relaxed text-sm">

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">1. Objet</h2>
            <p>
              Les présentes Conditions Générales d&apos;Utilisation (« CGU ») ont pour objet de définir les modalités
              d&apos;utilisation de la plateforme <b>SecrétariatPro</b> (ci-après « la Plateforme »), service de mise
              en relation entre des entreprises ou particuliers (« Entreprise ») et des secrétaires indépendantes
              (« Secrétaire »).
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">2. Acceptation</h2>
            <p>
              L&apos;inscription sur la Plateforme implique l&apos;acceptation pleine et entière des présentes CGU.
              L&apos;utilisateur s&apos;engage à les respecter et reconnaît en avoir pris connaissance.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">3. Inscription et compte</h2>
            <p>
              L&apos;inscription est gratuite. L&apos;utilisateur fournit des informations exactes et tient son
              compte à jour. Il choisit un mot de passe sécurisé et reste seul responsable de l&apos;activité
              effectuée depuis son compte.
            </p>
            <p className="mt-2">
              Trois rôles existent : <b>Entreprise</b>, <b>Secrétaire</b>, et <b>Administrateur</b>. Seule la
              Plateforme attribue le rôle d&apos;Administrateur.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">4. Services proposés</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>Publication de missions par les Entreprises.</li>
              <li>Candidatures des Secrétaires aux missions ouvertes.</li>
              <li>Proposition d&apos;offres directes des Entreprises aux Secrétaires.</li>
              <li>Finalisation des mises en relation par la Plateforme.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">5. Tarification et paiement</h2>
            <p>
              Le tarif de chaque prestation est <b>fixé par la Plateforme</b> au moment de la mise en relation,
              en fonction du volume et du type de mission. Aucun tarif n&apos;est négocié directement entre
              l&apos;Entreprise et la Secrétaire.
            </p>
            <p className="mt-2">
              Modalité de paiement par défaut : 50 % à la commande, 50 % à la livraison de la prestation.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">6. Confidentialité des coordonnées</h2>
            <p>
              Les coordonnées personnelles des Secrétaires (numéro de téléphone, comptes sociaux…) ne sont
              <b> jamais accessibles aux Entreprises</b>. La mise en relation se fait exclusivement via la
              Plateforme. Tout contournement (recherche directe, contact via un tiers…) constitue un manquement
              aux CGU.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">7. Obligations de l&apos;utilisateur</h2>
            <p>L&apos;utilisateur s&apos;engage à :</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Fournir des informations exactes et à jour.</li>
              <li>Ne pas utiliser la Plateforme à des fins illicites.</li>
              <li>Ne pas publier de contenu offensant, diffamatoire ou contraire aux bonnes mœurs.</li>
              <li>Respecter la confidentialité des échanges avec les autres utilisateurs.</li>
              <li>Ne pas tenter de contourner les mécanismes de mise en relation de la Plateforme.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">8. Responsabilité</h2>
            <p>
              La Plateforme agit en tant qu&apos;intermédiaire. Elle ne peut être tenue responsable de la qualité
              des prestations rendues ni des relations contractuelles directes entre les utilisateurs après
              mise en relation. Elle s&apos;engage néanmoins à mettre en œuvre les moyens nécessaires pour
              vérifier la qualité des profils inscrits.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">9. Données personnelles</h2>
            <p>
              Le traitement des données personnelles est détaillé dans la{' '}
              <Link href="/confidentialite" className="font-bold text-blue-600 hover:underline">
                Politique de confidentialité
              </Link>.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">10. Suspension et résiliation</h2>
            <p>
              La Plateforme se réserve le droit de suspendre ou supprimer tout compte en cas de manquement
              aux présentes CGU, sans préavis ni indemnité. L&apos;utilisateur peut à tout moment demander
              la suppression de son compte par email.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">11. Modification des CGU</h2>
            <p>
              La Plateforme se réserve le droit de modifier les présentes CGU à tout moment. Les utilisateurs
              seront informés des modifications substantielles par notification ou email.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">12. Droit applicable et litiges</h2>
            <p>
              Les présentes CGU sont régies par le droit ivoirien. En cas de litige, et après tentative de
              résolution amiable, les tribunaux d&apos;Abidjan sont seuls compétents.
            </p>
          </div>

        </section>

        <div className="mt-10 pt-6 border-t border-slate-100 flex gap-4 flex-wrap text-xs font-bold text-slate-500">
          <Link href="/mentions-legales" className="hover:text-blue-700">Mentions légales</Link>
          <Link href="/confidentialite" className="hover:text-blue-700">Politique de confidentialité</Link>
        </div>
      </article>
    </main>
  );
}
