'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';

type Props<T> = {
  items: T[];
  height: number;
  estimateSize?: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  className?: string;
};

export default function VirtualList<T>({ items, height, estimateSize = 60, renderItem, className = '' }: Props<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 5,
  });

  return (
    <div ref={parentRef} style={{ height, overflow: 'auto' }} className={className}>
      <div style={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
            ref={virtualizer.measureElement}
            data-index={virtualRow.index}
          >
            {renderItem(items[virtualRow.index], virtualRow.index)}
          </div>
        ))}
      </div>
    </div>
  );
}
