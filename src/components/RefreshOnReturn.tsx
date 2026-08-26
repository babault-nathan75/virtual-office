'use client';

import { useRouter } from 'next/navigation';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

/**
 * Rafraîchit un écran rendu côté serveur quand l'utilisateur y revient.
 *
 * Les tableaux de bord sont des composants serveur : leur contenu est figé au
 * moment du rendu. Un onglet laissé ouvert affichait donc indéfiniment l'état
 * d'alors — nouvelles candidatures, dossiers traités, missions publiées entre
 * temps restaient invisibles jusqu'à un rechargement manuel.
 *
 * `router.refresh()` redemande le rendu au serveur et remplace le contenu en
 * place, sans recharger la page ni perdre l'état des composants client.
 *
 * À placer une seule fois par écran.
 */
export default function RefreshOnReturn({
  staleAfterMs = 20_000,
  intervalMs,
}: {
  staleAfterMs?: number;
  intervalMs?: number;
}) {
  const router = useRouter();
  useAutoRefresh(() => router.refresh(), { staleAfterMs, intervalMs });
  return null;
}
