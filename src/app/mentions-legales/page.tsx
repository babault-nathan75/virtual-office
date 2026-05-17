import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Mentions légales — SecrétariatPro',
  description: 'Mentions légales du site SecrétariatPro.',
};

export default function MentionsLegales() {
  return (
    <main className="min-h-screen bg-slate-50 py-12 px-4 font-sans antialiased">
      <article className="max-w-3xl mx-auto bg-white rounded-3xl border border-slate-100 shadow-[0_15px_30px_rgba(0,0,0,0.03)] p-6 md:p-10">

        <Link href="/" className="inline-flex items-center text-sm font-bold text-blue-600 hover:text-blue-800 mb-6 transition">
          ← Accueil
        </Link>

        <h1 className="text-3xl font-black tracking-tight text-slate-900 mb-2">Mentions légales</h1>
        <p className="text-sm text-slate-500 font-medium mb-8">Dernière mise à jour : à compléter</p>

        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-2xl p-4 mb-8 font-medium">
          ⚠️ Document modèle — remplacez les <code className="bg-amber-100 px-1.5 py-0.5 rounded text-xs">[TODO]</code> par vos vraies informations avant la mise en ligne.
        </div>

        <section className="space-y-6 text-slate-700 leading-relaxed">

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">1. Éditeur du site</h2>
            <ul className="space-y-1 text-sm">
              <li><b>Raison sociale :</b> [TODO — nom de votre entreprise]</li>
              <li><b>Forme juridique :</b> [TODO — SARL, SAS, entreprise individuelle…]</li>
              <li><b>RCCM :</b> [TODO — votre numéro RCCM]</li>
              <li><b>Siège social :</b> [TODO — adresse complète à Abidjan]</li>
              <li><b>Téléphone :</b> [TODO]</li>
              <li><b>Email :</b> [TODO]</li>
              <li><b>Directeur de la publication :</b> [TODO — nom du responsable]</li>
            </ul>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">2. Hébergement</h2>
            <p className="text-sm">
              Le site est hébergé par <b>[TODO — ex: Vercel Inc., 340 S Lemon Ave #4133, Walnut, CA 91789, USA]</b>.
              La base de données et les services associés sont fournis par <b>Supabase Inc.</b> (970 Toa Payoh North #07-04, Singapore 318992).
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">3. Propriété intellectuelle</h2>
            <p className="text-sm">
              L&apos;ensemble du contenu du site (textes, images, logos, marques, mise en page…) est protégé par les lois en vigueur
              en Côte d&apos;Ivoire et au niveau international. Toute reproduction, représentation ou diffusion, totale ou partielle,
              sans autorisation préalable écrite de l&apos;éditeur, est strictement interdite et susceptible de constituer un acte de
              contrefaçon.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">4. Liens hypertextes</h2>
            <p className="text-sm">
              Le site peut contenir des liens vers des sites tiers. L&apos;éditeur n&apos;exerce aucun contrôle sur ces sites et
              décline toute responsabilité quant à leur contenu, leur politique de confidentialité ou leurs pratiques.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">5. Données personnelles</h2>
            <p className="text-sm">
              Le traitement des données personnelles est détaillé dans notre{' '}
              <Link href="/confidentialite" className="font-bold text-blue-600 hover:underline">Politique de confidentialité</Link>.
            </p>
          </div>

          <div>
            <h2 className="text-lg font-black tracking-tight text-slate-900 mb-2">6. Droit applicable</h2>
            <p className="text-sm">
              Le présent site et son utilisation sont régis par le droit ivoirien. Tout litige relatif à son utilisation
              relève de la compétence exclusive des tribunaux d&apos;Abidjan.
            </p>
          </div>

        </section>

        <div className="mt-10 pt-6 border-t border-slate-100 flex gap-4 flex-wrap text-xs font-bold text-slate-500">
          <Link href="/cgu" className="hover:text-blue-700">Conditions générales</Link>
          <Link href="/confidentialite" className="hover:text-blue-700">Politique de confidentialité</Link>
        </div>
      </article>
    </main>
  );
}
