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
      <div className="w-full max-w-xs text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
          <AlertTriangle size={24} strokeWidth={1.75} />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-zinc-50">مشکلی پیش آمد</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          این صفحه بارگذاری نشد. اطلاعاتت سر جایش است؛ دوباره تلاش کن.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-zinc-50 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white"
        >
          تلاش دوباره
        </button>
      </div>
    </div>
  );
}
