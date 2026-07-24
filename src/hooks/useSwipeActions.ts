'use client';

import { useState, useCallback } from 'react';

export function useSwipeActions({ onSwipeLeft, onSwipeRight }: { onSwipeLeft?: () => void; onSwipeRight?: () => void }) {
  const [startX, setStartX] = useState(0);
  const [offset, setOffset] = useState(0);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setOffset(0);
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const diff = e.touches[0].clientX - startX;
    setOffset(diff);
  }, [startX]);

  const onTouchEnd = useCallback(() => {
    if (offset < -80 && onSwipeLeft) onSwipeLeft();
    else if (offset > 80 && onSwipeRight) onSwipeRight();
    setOffset(0);
  }, [offset, onSwipeLeft, onSwipeRight]);

  return { offset, onTouchStart, onTouchMove, onTouchEnd };
}
