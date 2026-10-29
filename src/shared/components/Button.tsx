'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-zinc-50 hover:bg-white text-zinc-900 disabled:opacity-40',
  secondary: 'bg-white/6 hover:bg-white/10 text-zinc-100 disabled:opacity-40',
  danger: 'bg-rose-500/10 hover:bg-rose-500/15 text-rose-300 disabled:opacity-40',
  ghost: 'bg-transparent hover:bg-white/5 text-zinc-300 disabled:opacity-40',
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
      className={`h-11 px-4 rounded-xl text-sm font-medium transition-colors active:scale-[0.98] ${VARIANT_STYLES[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
