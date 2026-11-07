import Link from 'next/link';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-background text-zinc-200 flex items-center justify-center p-6">
      <div className="w-full max-w-xs text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/6 text-zinc-300">
          <Compass size={24} strokeWidth={1.75} />
        </span>
        <p className="mt-5 text-xs font-medium text-zinc-500">خطای ۴۰۴</p>
        <h1 className="mt-1 text-xl font-semibold text-zinc-50">این صفحه پیدا نشد</h1>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          شاید آدرس اشتباه است یا این مورد حذف شده.
        </p>
        <Link
          href="/"
          className="mt-6 flex h-12 w-full items-center justify-center rounded-2xl bg-zinc-50 text-sm font-semibold text-zinc-900 transition-colors hover:bg-white"
        >
          بازگشت به خانه
        </Link>
      </div>
    </div>
  );
}
