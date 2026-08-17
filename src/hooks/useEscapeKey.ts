'use client';

import { useEffect } from 'react';

/**
 * Ferme un élément superposé (modale, panneau) à la touche Échap.
 *
 * Plusieurs modales de l'application ne se fermaient qu'au clic sur le fond ou
 * sur la croix : au clavier, elles piégeaient l'utilisateur.
 */
export function useEscapeKey(active: boolean, onEscape: () => void) {
  useEffect(() => {
    if (!active) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onEscape();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, onEscape]);
}
