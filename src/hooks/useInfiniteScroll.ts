'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

type UseInfiniteScrollOptions<T> = {
  fetchFn: (page: number) => Promise<T[]>;
  pageSize?: number;
  threshold?: number;
};

export function useInfiniteScroll<T>({ fetchFn, pageSize = 20, threshold = 200 }: UseInfiniteScrollOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const fetchFnRef = useRef(fetchFn);
  fetchFnRef.current = fetchFn;

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const newItems = await fetchFnRef.current(page);
      if (newItems.length < pageSize) {
        setHasMore(false);
      }
      setItems(prev => [...prev, ...newItems]);
      setPage(prev => prev + 1);
    } catch {
      setHasMore(false);
    }
    setLoading(false);
  }, [page, loading, hasMore, pageSize]);

  useEffect(() => {
    if (!sentinelRef.current) return;

    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { rootMargin: `${threshold}px` }
    );

    observerRef.current.observe(sentinelRef.current);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [loadMore, hasMore, loading, threshold]);

  const reset = useCallback(() => {
    setItems([]);
    setPage(1);
    setHasMore(true);
    setLoading(false);
  }, []);

  return { items, loading, hasMore, sentinelRef, reset };
}
