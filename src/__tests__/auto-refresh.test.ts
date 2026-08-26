/**
 * Tests du rafraîchissement automatique.
 *
 * Le mécanisme dispense l'utilisateur de recharger la page : s'il se déclenche
 * trop peu, l'écran reste périmé et le rechargement manuel revient ; s'il se
 * déclenche trop, il interroge la base à chaque aller-retour entre deux
 * onglets. Le seuil d'ancienneté et le verrou anti-concurrence sont donc les
 * deux points à garder sous contrôle.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

let visibility: DocumentVisibilityState = 'visible';

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAutoRefresh', () => {
  it('ne recharge pas au montage', () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh));
    // Les données viennent d'être chargées par la page elle-même : recharger
    // aussitôt doublerait chaque ouverture d'écran.
    expect(refresh).not.toHaveBeenCalled();
  });

  it('recharge au retour sur l\'onglet quand les données ont vieilli', async () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh, { staleAfterMs: 1000 }));

    await act(async () => {
      setVisibility('hidden');
      vi.advanceTimersByTime(5000);
      setVisibility('visible');
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('ignore un aller-retour trop bref', async () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh, { staleAfterMs: 30_000 }));

    await act(async () => {
      setVisibility('hidden');
      vi.advanceTimersByTime(500);
      setVisibility('visible');
    });

    expect(refresh).not.toHaveBeenCalled();
  });

  it('recharge à la reconnexion réseau, sans condition d\'ancienneté', async () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh, { staleAfterMs: 30_000 }));

    // Après une coupure, les données affichées datent d'avant : le seuil ne
    // s'applique pas.
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('recharge périodiquement quand un intervalle est demandé', async () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh, { intervalMs: 1000 }));

    /*
     * Les tics sont avancés un par un, chacun dans son propre `act`.
     *
     * Avancer 3 500 ms d'un coup ferait se déclencher les trois minuteurs sans
     * qu'aucune micro-tâche ne s'intercale : le verrou anti-concurrence, qui
     * se relâche après un `await`, resterait fermé et deux tics seraient
     * ignorés. Ce cas ne peut pas se produire avec de vrais minuteurs, où une
     * seconde entière sépare deux tics — le test décrirait donc un défaut qui
     * n'existe pas.
     */
    for (let tick = 0; tick < 3; tick += 1) {
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
    }

    expect(refresh).toHaveBeenCalledTimes(3);
  });

  it('suspend l\'intervalle quand l\'onglet est caché', async () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh, { intervalMs: 1000 }));

    await act(async () => {
      setVisibility('hidden');
      vi.advanceTimersByTime(5000);
    });

    // Interroger la base pour un écran que personne ne regarde est du travail
    // pur perte — et multiplié par le nombre d'onglets oubliés.
    expect(refresh).not.toHaveBeenCalled();
  });

  it('ne lance pas deux rechargements en parallèle', async () => {
    let resolve: (() => void) | undefined;
    const refresh = vi.fn(() => new Promise<void>(r => { resolve = r; }));

    renderHook(() => useAutoRefresh(refresh, { intervalMs: 100 }));

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Le premier appel n'est pas terminé : les suivants sont ignorés, sinon
    // les réponses pourraient revenir dans le désordre et écraser l'état le
    // plus récent par le plus ancien.
    expect(refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolve?.();
    });
  });

  it('peut être désactivé', async () => {
    const refresh = vi.fn();
    renderHook(() => useAutoRefresh(refresh, { enabled: false, intervalMs: 100 }));

    await act(async () => {
      vi.advanceTimersByTime(1000);
      window.dispatchEvent(new Event('online'));
    });

    expect(refresh).not.toHaveBeenCalled();
  });

  it('retire ses écouteurs au démontage', async () => {
    const refresh = vi.fn();
    const { unmount } = renderHook(() => useAutoRefresh(refresh, { staleAfterMs: 0 }));

    unmount();

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      setVisibility('visible');
    });

    expect(refresh).not.toHaveBeenCalled();
  });
});
