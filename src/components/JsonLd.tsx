import { getSiteUrl } from '@/lib/env';
import { COUNTRY_CODE, COUNTRY_NAME, LOCALE } from '@/lib/i18n';

/**
 * Données structurées schema.org.
 *
 * Le domaine était écrit en dur dans chaque bloc : sur un déploiement de
 * prévisualisation, les données structurées désignaient le site de production,
 * ce que les moteurs interprètent comme une duplication.
 */
function JsonLdScript({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify échappe déjà les guillemets ; on neutralise en plus la
      // séquence `</script>` qui, dans une valeur de chaîne, fermerait la
      // balise et permettrait une injection.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  );
}

export function OrganizationJsonLd() {
  const site = getSiteUrl();

  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'SecrétariatPro',
        url: site,
        logo: `${site}/logo.png`,
        description:
          'Plateforme de mise en relation entre entreprises et secrétaires qualifiées.',
        sameAs: [],
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer service',
          availableLanguage: ['French', 'English'],
        },
        // Le pays déclaré était « FR ». Les constantes du produit (langues
        // baoulé, dioula, bété, sénoufo ; logiciels Sage/Saari ; indicatif
        // +225) désignent la Côte d'Ivoire : un pays erroné dessert le
        // référencement local, qui est précisément celui qui compte pour une
        // mise en relation de proximité.
        address: { '@type': 'PostalAddress', addressCountry: COUNTRY_CODE },
        areaServed: { '@type': 'Country', name: COUNTRY_NAME },
      }}
    />
  );
}

export function WebSiteJsonLd() {
  const site = getSiteUrl();

  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'SecrétariatPro',
        url: site,
        inLanguage: LOCALE,
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${site}/dashboard/entreprise/chercher?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      }}
    />
  );
}

export function FAQJsonLd() {
  const faq: Array<[string, string]> = [
    [
      'Comment trouver une secrétaire sur SecrétariatPro ?',
      "Inscrivez-vous en tant qu'entreprise, complétez votre profil et parcourez les profils de secrétaires disponibles. Vous pouvez filtrer par compétences, disponibilités et tarifs.",
    ],
    [
      "Combien coûte l'utilisation de SecrétariatPro ?",
      "L'inscription est gratuite pour les entreprises comme pour les secrétaires. Les tarifs des missions sont fixés directement par chaque secrétaire.",
    ],
    [
      'Comment fonctionne la mise en relation ?',
      "Les entreprises publient leurs besoins, les secrétaires candidatent et l'entreprise sélectionne le profil qui lui convient. Un contrat est ensuite généré automatiquement.",
    ],
    [
      'Les données sont-elles sécurisées ?',
      "Oui. Les échanges sont chiffrés, l'identité de chaque membre est vérifiée (KYC) et un code à usage unique est demandé à chaque connexion, en plus du mot de passe.",
    ],
    [
      'Comment mon compte est-il protégé si mon mot de passe est volé ?',
      "Un code à usage unique vous est envoyé par email à chaque connexion : un mot de passe seul ne suffit jamais à ouvrir une session. Vous pouvez aussi activer une application d'authentification.",
    ],
  ];

  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map(([question, answer]) => ({
          '@type': 'Question',
          name: question,
          acceptedAnswer: { '@type': 'Answer', text: answer },
        })),
      }}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  return (
    <JsonLdScript
      data={{
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((item, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      }}
    />
  );
}
