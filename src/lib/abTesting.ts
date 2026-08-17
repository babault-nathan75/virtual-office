'use client';

import { useCallback, useSyncExternalStore } from 'react';

type Variant = 'A' | 'B';

type ABTestResult = {
  variant: Variant;
  isLoading: boolean;
};

// Snapshot mémorisé par test : `useSyncExternalStore` exige qu'un snapshot
// inchangé renvoie une référence identique, sinon le rendu boucle.
const assigned = new Map<string, Variant>();

function readOrAssignVariant(testName: string, weight: number): Variant {
  const cached = assigned.get(testName);
  if (cached) return cached;

  let variant: Variant;
  try {
    const stored = localStorage.getItem(`ab-${testName}`);
    if (stored === 'A' || stored === 'B') {
      variant = stored;
    } else {
      variant = Math.random() < weight ? 'A' : 'B';
      localStorage.setItem(`ab-${testName}`, variant);
    }
  } catch {
    // Stockage indisponible (mode privé, quota) : variante par défaut.
    variant = 'A';
  }

  assigned.set(testName, variant);
  return variant;
}

// Aucun abonnement : l'affectation est figée pour la durée de la session.
const subscribe = () => () => {};

/**
 * Lit la variante après hydratation. `useSyncExternalStore` est utilisé plutôt
 * qu'un `useEffect` + `setState` : il donne un snapshot serveur explicite
 * (null) et évite le rendu en cascade que provoquait l'ancienne version.
 */
export function useABTest(testName: string, weight = 0.5): ABTestResult {
  const getSnapshot = useCallback(() => readOrAssignVariant(testName, weight), [testName, weight]);
  const getServerSnapshot = useCallback((): Variant | null => null, []);

  const variant = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return variant === null ? { variant: 'A', isLoading: true } : { variant, isLoading: false };
}

export function trackABEvent(testName: string, variant: Variant, event: string, props?: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('ab-test', { detail: { testName, variant, event, props } }));
  } catch {}
}
