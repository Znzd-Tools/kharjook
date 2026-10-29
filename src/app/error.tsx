'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export default function Error({
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
    <div className="min-h-dvh bg-background text-zinc-200 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-4">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
          <AlertTriangle size={24} className="text-rose-400" />
        </div>
        <h1 className="text-lg font-semibold text-white">خطایی رخ داد</h1>
        <p className="text-sm text-zinc-400">
          مشکلی در بارگذاری صفحه پیش آمد. دوباره تلاش کن.
        </p>
        <button
          type="button"
          onClick={reset}
          className="px-6 py-2.5 rounded-xl bg-zinc-50 hover:bg-white text-zinc-900 text-sm font-medium transition-colors"
        >
          تلاش مجدد
        </button>
      </div>
    </div>
  );
}
