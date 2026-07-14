'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-500/20 disabled:opacity-50',
  secondary:
    'bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 disabled:opacity-50',
  danger:
    'bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 disabled:opacity-50',
  ghost: 'bg-transparent hover:bg-white/5 text-slate-300 disabled:opacity-50',
};

export function Button({
  variant = 'primary',
  children,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors active:scale-[0.98] ${VARIANT_STYLES[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
