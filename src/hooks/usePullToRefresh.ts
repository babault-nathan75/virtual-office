'use client';

import { useState, useCallback, useRef } from 'react';

export function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    startY.current = e.touches[0].clientY;
  }, [refreshing]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (refreshing) return;
    const diff = e.touches[0].clientY - startY.current;
    if (diff > 50) setPulling(true);
  }, [refreshing]);

  const onTouchEnd = useCallback(async () => {
    if (pulling && !refreshing) {
      setRefreshing(true);
      await onRefresh();
      setRefreshing(false);
    }
    setPulling(false);
  }, [pulling, refreshing, onRefresh]);

  return { pulling, refreshing, onTouchStart, onTouchMove, onTouchEnd };
}
