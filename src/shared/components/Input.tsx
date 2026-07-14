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
        <label htmlFor={inputId} className="block text-xs text-slate-400 mb-1.5 ml-1">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={`w-full bg-surface-raised border rounded-xl py-3 text-sm text-white placeholder:text-slate-500 focus:border-purple-500 outline-none transition-colors ${
            icon ? 'pl-10 pr-4' : 'px-4'
          } ${error ? 'border-rose-500/50' : 'border-white/10'} ${className}`}
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
