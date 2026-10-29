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
      <body className="min-h-dvh bg-surface-inset text-zinc-200 flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <h1 className="text-lg font-semibold text-white">خطای سیستمی</h1>
          <p className="text-sm text-zinc-400">اپ دچار مشکل شد. صفحه را دوباره بارگذاری کن.</p>
          <button
            type="button"
            onClick={reset}
            className="px-6 py-2.5 rounded-xl bg-zinc-50 text-zinc-900 text-sm font-medium"
          >
            تلاش مجدد
          </button>
        </div>
      </body>
    </html>
  );
}
