'use client';

import Link from 'next/link';
import { Lock, RefreshCw, User as UserIcon, Wallet } from 'lucide-react';
import useRegisterView from './useRegisterView';

export function RegisterView() {
  const {
    error,
    handleRegister,
    isSubmitting,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
  } = useRegisterView();

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
          <p className="text-zinc-500 text-xs">ساخت حساب جدید</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4 relative z-10">
          {error && (
            <div
              role="alert"
              className="bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs p-3 rounded-xl text-center"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="register-email" className="block text-xs font-medium text-zinc-400 mb-1.5">
              ایمیل
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                <UserIcon size={18} />
              </span>
              <input
                id="register-email"
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
            <label htmlFor="register-password" className="block text-xs font-medium text-zinc-400 mb-1.5">
              رمز عبور
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                <Lock size={18} />
              </span>
              <input
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-surface-inset border border-white/8 rounded-xl h-12 px-4 pl-10 text-white text-left focus:border-accent-400 focus:ring-4 focus:ring-accent-500/10 outline-none transition-all  tracking-widest"
                dir="ltr"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="register-confirm-password" className="block text-xs font-medium text-zinc-400 mb-1.5">
              تکرار رمز عبور
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                <Lock size={18} />
              </span>
              <input
                id="register-confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-surface-inset border border-white/8 rounded-xl h-12 px-4 pl-10 text-white text-left focus:border-accent-400 focus:ring-4 focus:ring-accent-500/10 outline-none transition-all  tracking-widest"
                dir="ltr"
                autoComplete="new-password"
                minLength={6}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-zinc-50 hover:bg-white text-zinc-900 h-12 px-4 rounded-xl font-semibold transition-all mt-6 active:scale-95 disabled:opacity-50 flex justify-center items-center focus-visible:ring-2 focus-visible:ring-accent-400/50 focus-visible:outline-none"
          >
            {isSubmitting ? (
              <RefreshCw size={20} className="animate-spin" />
            ) : (
              'ساخت حساب'
            )}
          </button>

          <p className="text-center text-xs text-zinc-500 pt-2">
            حساب داری؟{' '}
            <Link
              href="/login"
              className="text-accent-400 hover:text-accent-300 font-medium transition-colors"
            >
              ورود
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
