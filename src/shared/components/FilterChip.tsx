'use client';

import type { ReactNode } from 'react';

export function FilterChip({
  active,
  onClick,
  children,
  activeClassName = 'bg-zinc-50 border-zinc-50 text-zinc-900',
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
      className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition active:scale-[0.98] ${className} ${
        active
          ? activeClassName
          : 'bg-transparent border-white/8 text-zinc-400 hover:text-zinc-200 hover:border-white/15'
      }`}
    >
      {children}
    </button>
  );
}
