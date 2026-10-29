'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Lock, Fingerprint, RefreshCw, User as UserIcon, Wallet } from 'lucide-react';
import useLoginView from './useLoginView';

export function LoginView() {
	const {
    error,
    handleLogin,
    handlePasskeyLogin,
    isSubmitting,
    isPasskeySubmitting,
    passkeySupported,
    password,
    email,
    setPassword,
    setEmail,
  } = useLoginView()
	const searchParams = useSearchParams();
	// Set by RegisterView when email confirmation is required — harmless no-op
	// when confirmation is off (redirect in that path never fires).
	const justRegistered = searchParams.get('registered') === '1';
 
  return (
    <div className="bg-background text-zinc-200 min-h-screen font-sans flex items-stretch sm:items-center justify-center sm:p-4">
      <div className="w-full sm:max-w-md bg-surface-shell p-6 sm:p-8 sm:rounded-2xl sm:border border-white/5 relative overflow-hidden flex flex-col justify-center sm:block animate-[fade-in_500ms_ease-out] sm:animate-[fade-zoom-in_500ms_ease-out]">

        <div className="text-center mb-8 relative z-10">
          <div className="w-12 h-12 bg-accent-600 rounded-2xl mx-auto flex items-center justify-center mb-5">
            <Wallet size={22} className="text-white" strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-semibold text-zinc-50 mb-1.5 tracking-tight">
            خرجوک
          </h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 relative z-10">
          {justRegistered && !error && (
            <div
              role="status"
              className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-xl text-center"
            >
              حساب با موفقیت ساخته شد. لطفاً وارد شو.
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl text-center"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="login-email" className="block text-xs font-medium text-zinc-400 mb-1.5">
              ایمیل
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                <UserIcon size={18} />
              </span>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-inset border border-white/8 rounded-xl h-12 px-4 pl-10 text-white text-left focus:border-accent-400 focus:ring-4 focus:ring-accent-500/10 outline-none transition-all "
                dir="ltr"
                autoComplete="email"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password" className="block text-xs font-medium text-zinc-400 mb-1.5">
              رمز عبور
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                <Lock size={18} />
              </span>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-inset border border-white/8 rounded-xl h-12 px-4 pl-10 text-white text-left focus:border-accent-400 focus:ring-4 focus:ring-accent-500/10 outline-none transition-all  tracking-widest"
                dir="ltr"
                autoComplete="current-password"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isPasskeySubmitting}
            className="w-full bg-zinc-50 hover:bg-white text-zinc-900 h-12 px-4 rounded-xl font-semibold transition-all mt-6 active:scale-95 disabled:opacity-50 flex justify-center items-center focus-visible:ring-2 focus-visible:ring-accent-400/50 focus-visible:outline-none"
          >
            {isSubmitting ? (
              <RefreshCw size={20} className="animate-spin" />
            ) : (
              'ورود به حساب'
            )}
          </button>

          {passkeySupported ? (
            <button
              type="button"
              onClick={() => void handlePasskeyLogin()}
              disabled={isSubmitting || isPasskeySubmitting}
              className="w-full bg-white/6 hover:bg-white/10 text-zinc-100 h-12 px-4 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 flex justify-center items-center gap-2"
            >
              {isPasskeySubmitting ? (
                <RefreshCw size={18} className="animate-spin" />
              ) : (
                <>
                  <Fingerprint size={18} />
                  ورود با بیومتریک
                </>
              )}
            </button>
          ) : null}

          <p className="text-center text-xs text-zinc-500 pt-2">
            حساب نداری؟{' '}
            <Link
              href="/register"
              className="text-accent-400 hover:text-accent-300 font-medium transition-colors"
            >
              ثبت‌نام
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
