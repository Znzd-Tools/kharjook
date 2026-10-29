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
        <label htmlFor={inputId} className="block text-xs font-medium text-zinc-400 mb-1.5">
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
          className={`w-full h-11 bg-surface-inset border rounded-xl text-sm text-zinc-50 placeholder:text-zinc-600 focus:border-accent-400 focus:ring-4 focus:ring-accent-500/10 outline-none transition ${
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
