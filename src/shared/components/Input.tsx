'use client';

import type { InputHTMLAttributes, ReactNode } from 'react';

export function Input({
  label,
  icon,
  error,
  className = '',
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  icon?: ReactNode;
  error?: string | null;
}) {
  const inputId = id ?? label;
  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-xs font-medium text-zinc-400">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={`w-full min-h-11 rounded-xl border border-white/8 bg-surface-inset px-3.5 py-2.5 text-sm text-zinc-50 placeholder:text-zinc-600 outline-none transition focus:border-accent-400 focus:ring-4 focus:ring-accent-500/10 h-11 text-zinc-50 ${
            icon ? 'pl-10 pr-4' : 'px-4'
          } ${error ? 'border-rose-500/50' : 'border-white/8'} ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-rose-400 mt-1.5 mr-1">
          {error}
        </p>
      )}
    </div>
  );
}
