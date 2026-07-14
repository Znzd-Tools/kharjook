import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-background text-slate-200 flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-4">
        <h1 className="text-4xl font-bold text-white">۴۰۴</h1>
        <p className="text-sm text-slate-400">صفحه‌ای که دنبالش بودی پیدا نشد.</p>
        <Link
          href="/"
          className="inline-block px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
        >
          بازگشت به داشبورد
        </Link>
      </div>
    </div>
  );
}
