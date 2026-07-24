export function OrganizationJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'SecrétariatPro',
    url: 'https://secretariatpro-drab.vercel.app',
    logo: 'https://secretariatpro-drab.vercel.app/logo.png',
    description: 'Plateforme de mise en relation entre entreprises et secrétaires qualifiées.',
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: 'French',
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'FR',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function WebSiteJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'SecrétariatPro',
    url: 'https://secretariatpro-drab.vercel.app',
    potentialAction: {
      '@type': 'SearchAction',
      target: 'https://secretariatpro-drab.vercel.app/dashboard/entreprise/chercher?q={search_term_string}',
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function FAQJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: 'Comment trouver une secrétaire sur SecrétariatPro ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Inscrivez-vous en tant qu\'entreprise, complétez votre profil et parcourez les profils de secrétaires disponibles. Vous pouvez filtrer par compétences, disponibilités et tarifs.',
        },
      },
      {
        '@type': 'Question',
        name: 'Combien coûte l\'utilisation de SecrétariatPro ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'L\'inscription est gratuite pour les entreprises comme pour les secrétaires. Les tarifs sont fixés directement par chaque secrétaire.',
        },
      },
      {
        '@type': 'Question',
        name: 'Comment fonctionne la mise en relation ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Les entreprises publient leurs besoins, les secrétaires candidate et l\'entreprise sélectionne le profil idéal. Un contrat est ensuite généré automatiquement.',
        },
      },
      {
        '@type': 'Question',
        name: 'Les données sont-elles sécurisées ?',
        acceptedAnswer: {
          '@type': 'Answer',
          text: 'Oui, toutes les données sont chiffrées et protégées. La vérification d\'identité (KYC) et l\'authentification à deux facteurs (2FA) sont disponibles.',
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
