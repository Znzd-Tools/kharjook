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
      <body className="min-h-dvh bg-[#09090b] text-zinc-200 flex items-center justify-center p-6">
        <div className="w-full max-w-xs text-center space-y-3">
          <h1 className="text-xl font-semibold text-zinc-50">خطای سیستمی</h1>
          <p className="text-sm text-zinc-400">اپ دچار مشکل شد. صفحه را دوباره بارگذاری کن.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-3 h-12 w-full rounded-2xl bg-zinc-50 text-zinc-900 text-sm font-semibold"
          >
            تلاش مجدد
          </button>
        </div>
      </body>
    </html>
  );
}
