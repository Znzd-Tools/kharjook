'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export function RedirectToPrices({ advanced = false }: { advanced?: boolean }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(advanced ? '/prices?advanced=1' : '/prices');
  }, [router, advanced]);

  return null;
}
