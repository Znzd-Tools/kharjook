'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="fa" dir="rtl">
      <body className="flex min-h-dvh items-center justify-center bg-canvas p-6 text-fg">
        <div className="text-center space-y-4">
          <h1 className="text-title font-bold">خطای سیستمی</h1>
          <p className="text-callout text-fg-muted">اپ دچار مشکل شد. صفحه را دوباره بارگذاری کن.</p>
          <button
            type="button"
            onClick={reset}
            className="h-11 rounded-control bg-accent px-6 text-callout font-semibold text-fg-on-accent"
          >
            تلاش دوباره
          </button>
        </div>
      </body>
    </html>
  );
}
