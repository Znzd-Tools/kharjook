'use client';

import { useEffect } from 'react';
import { Button, EmptyState } from '@/design-system';
import { AlertTriangle } from '@/design-system/icons';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-canvas p-6">
      <EmptyState
        icon={<AlertTriangle />}
        title="خطایی رخ داد"
        description="صفحه بارگذاری نشد. دوباره تلاش کن."
        action={<Button onClick={reset}>تلاش دوباره</Button>}
      />
    </div>
  );
}
