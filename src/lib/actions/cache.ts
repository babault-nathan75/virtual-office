'use server';

import { updateTag } from 'next/cache';
import { CACHE_SCOPES, type CacheScope } from '@/lib/cacheScopes';

/**
 * Invalidation du cache serveur après une écriture faite depuis le navigateur.
 *
 * Les tableaux de bord sont rendus côté serveur et mis en cache par
 * `unstable_cache` sous des étiquettes (`entreprise-dashboard`,
 * `secretaire-dashboard`…). Les mutations, elles, partent du navigateur.
 *
 * Sans ce pont, les deux se désynchronisent d'une façon particulièrement
 * déroutante : l'écran se met bien à jour sur le moment — les composants
 * appliquent leur mise à jour optimiste — mais quitter la page puis y revenir
 * réaffiche l'état d'avant, servi par le cache. L'utilisateur croit alors que
 * son action a été perdue, et recharge la page pour en avoir le cœur net.
 *
 * `updateTag` plutôt que `revalidateTag` : le second continue de servir la
 * valeur périmée pendant qu'il rafraîchit en arrière-plan, ce qui reproduirait
 * exactement le symptôme qu'on cherche à supprimer. `updateTag` expire
 * immédiatement — c'est le cas « l'utilisateur doit voir sa propre écriture ».
 */

export async function revalidateScope(scope: CacheScope): Promise<void> {
  const tags = CACHE_SCOPES[scope];
  if (!tags) return;

  for (const tag of tags) {
    updateTag(tag);
  }
}
