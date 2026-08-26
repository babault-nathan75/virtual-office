/**
 * Périmètres de cache invalidables depuis le navigateur.
 *
 * Déclarés hors du module « use server » : un fichier marqué ainsi ne doit
 * exporter que des fonctions asynchrones. Next 16 tolère aujourd'hui une
 * constante, mais la contrainte est documentée et peut être appliquée à tout
 * moment — mieux vaut ne pas en dépendre.
 *
 * Liste fermée : l'invalidation n'est pas une frontière de sécurité, mais
 * accepter une chaîne libre venue du navigateur laisserait créer autant
 * d'étiquettes que voulu dans le cache.
 */
export const CACHE_SCOPES = {
  'admin-dashboard': ['admin-dashboard'],
  'admin-users': ['admin-users', 'admin-dashboard'],
  'admin-kyc': ['admin-kyc', 'admin-dashboard', 'secretaire-dashboard'],
  // Une candidature ou une offre change ce que voient les deux versants.
  candidatures: ['entreprise-dashboard', 'secretaire-dashboard'],
  // Une mission publiée doit apparaître aussitôt chez l'entreprise qui la crée
  // et dans la liste des missions ouvertes côté secrétaires.
  missions: ['entreprise-dashboard', 'secretaire-dashboard'],
  'profil-secretaire': ['secretaire-dashboard', 'secretaire-profile', 'entreprise-dashboard'],
} as const;

export type CacheScope = keyof typeof CACHE_SCOPES;
