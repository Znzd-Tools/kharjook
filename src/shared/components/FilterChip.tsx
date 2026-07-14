'use client';

import type { ReactNode } from 'react';

export function FilterChip({
  active,
  onClick,
  children,
  activeClassName = 'bg-purple-600/20 border-purple-500/40 text-purple-300',
  className = '',
  role,
  'aria-selected': ariaSelected,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  activeClassName?: string;
  className?: string;
  role?: 'tab';
  'aria-selected'?: boolean;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-selected={ariaSelected}
      onClick={onClick}
      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${className} ${
        active
          ? activeClassName
          : 'bg-surface-raised border-white/10 text-slate-400 hover:border-white/20'
      }`}
    >
      {children}
    </button>
  );
}
