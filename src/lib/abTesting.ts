'use client';

import { useState, useEffect, useCallback } from 'react';

type ABTestResult = {
  variant: 'A' | 'B';
  isLoading: boolean;
};

export function useABTest(testName: string, weight = 0.5): ABTestResult {
  const [result, setResult] = useState<ABTestResult>({ variant: 'A', isLoading: true });

  useEffect(() => {
    const stored = localStorage.getItem(`ab-${testName}`);
    if (stored === 'A' || stored === 'B') {
      setResult({ variant: stored, isLoading: false });
      return;
    }

    const variant: 'A' | 'B' = Math.random() < weight ? 'A' : 'B';
    localStorage.setItem(`ab-${testName}`, variant);
    setResult({ variant, isLoading: false });
  }, [testName, weight]);

  return result;
}

export function trackABEvent(testName: string, variant: 'A' | 'B', event: string, props?: Record<string, string>) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('ab-test', { detail: { testName, variant, event, props } }));
  } catch {}
}
