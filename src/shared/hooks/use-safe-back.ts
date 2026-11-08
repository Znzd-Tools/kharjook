'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect } from 'react';

/**
 * Count client-side route changes in this page load. A full page load
 * (deep link, shared SMS, refresh) starts at 0, so "back" would leave the
 * app or reload it — then we replace to a fallback instead.
 */
let inAppNavigations = 0;
let lastPath: string | null = null;

/** Mount once (in the shell) to track in-app navigations. */
export function useTrackNavigation() {
  const pathname = usePathname();
  useEffect(() => {
    if (lastPath !== null && lastPath !== pathname) inAppNavigations += 1;
    lastPath = pathname;
  }, [pathname]);
}

export function useSafeBack(fallback = '/') {
  const router = useRouter();
  return useCallback(() => {
    if (inAppNavigations > 0) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
