'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Rafraîchit des données sans que l'utilisateur ait à recharger la page.
 *
 * Les écrans du tableau de bord chargeaient leurs données une fois, au
 * montage, et plus jamais ensuite. Aucun n'écoutait le retour de l'onglet ni
 * la reconnexion réseau. Conséquence : revenir sur un onglet laissé ouvert, ou
 * simplement attendre qu'un administrateur traite un dossier, affichait un
 * état périmé — et le seul recours était d'appuyer sur F5.
 *
 * Trois déclencheurs, choisis pour couvrir les cas réels sans interroger la
 * base en permanence :
 *
 *  — **retour sur l'onglet** : c'est le moment où l'utilisateur regarde à
 *    nouveau l'écran, donc celui où la fraîcheur compte. Un seuil d'ancienneté
 *    évite de recharger pour un aller-retour de deux secondes vers un autre
 *    onglet.
 *  — **reconnexion réseau** : après une coupure, les données affichées datent
 *    d'avant la coupure et les éventuelles écritures ont échoué.
 *  — **intervalle**, optionnel : réservé aux écrans qu'on laisse ouverts en
 *    les regardant, comme une file d'attente d'administration. Suspendu quand
 *    l'onglet est caché, pour ne pas travailler dans le vide.
 */
type Options = {
  /**
   * Ancienneté minimale des données avant qu'un retour sur l'onglet ne
   * déclenche un rechargement.
   */
  staleAfterMs?: number;
  /** Rechargement périodique. Désactivé par défaut. */
  intervalMs?: number;
  /** Permet de suspendre le mécanisme (page non authentifiée, modale ouverte…). */
  enabled?: boolean;
};

export function useAutoRefresh(
  refresh: () => void | Promise<void>,
  { staleAfterMs = 30_000, intervalMs, enabled = true }: Options = {}
) {
  // La fonction de rechargement est souvent recréée à chaque rendu. La garder
  // dans une ref évite de réinstaller les écouteurs à chaque fois — ce qui, sur
  // un intervalle, reviendrait à le redémarrer sans cesse et à ne jamais le
  // déclencher.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const lastRunRef = useRef(Date.now());
  const runningRef = useRef(false);

  const run = useCallback(async () => {
    // Un rechargement déjà en cours : inutile d'en lancer un second, il
    // écrirait le même état deux fois et pourrait arriver dans le désordre.
    if (runningRef.current) return;
    runningRef.current = true;
    try {
      await refreshRef.current();
      lastRunRef.current = Date.now();
    } finally {
      runningRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastRunRef.current < staleAfterMs) return;
      void run();
    };

    const onOnline = () => void run();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    // `focus` couvre le passage d'une autre fenêtre à celle-ci, que
    // `visibilitychange` ne signale pas toujours selon les navigateurs.
    window.addEventListener('focus', onVisible);

    let timer: ReturnType<typeof setInterval> | undefined;
    if (intervalMs && intervalMs > 0) {
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') void run();
      }, intervalMs);
    }

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onVisible);
      if (timer) clearInterval(timer);
    };
  }, [enabled, staleAfterMs, intervalMs, run]);

  /** Rechargement manuel — pour un bouton « Actualiser ». */
  return run;
}
