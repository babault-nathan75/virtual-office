'use client';

import NextLink from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useRef } from 'react';

type LinkProps = React.ComponentProps<typeof NextLink> & {
  prefetchOnHover?: boolean;
};

export default function Link({ prefetchOnHover = true, ...props }: LinkProps) {
  const router = useRouter();
  const prefetched = useRef(new Set<string>());

  const handleMouseEnter = useCallback(() => {
    if (!prefetchOnHover) return;
    const href = typeof props.href === 'string' ? props.href : '';
    if (href && !prefetched.current.has(href)) {
      prefetched.current.add(href);
      router.prefetch(href);
    }
  }, [props.href, prefetchOnHover, router]);

  return <NextLink {...props} prefetch={false} onMouseEnter={handleMouseEnter} />;
}
