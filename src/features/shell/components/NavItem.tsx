'use client';

import type { ReactNode } from 'react';

export interface NavItemProps {
  icon: ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function NavItem({
  icon,
  label,
  isActive,
  onClick,
  disabled,
}: NavItemProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-current={isActive ? 'page' : undefined}
      className={`flex flex-col items-center gap-1 min-w-14 py-1 transition-colors active:scale-95 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${isActive ? 'text-zinc-50' : 'text-zinc-500 hover:text-zinc-300'}`}
    >
      {icon}
      <span className={`text-[11px] ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
      <span
        aria-hidden
        className={`h-1 w-1 rounded-full transition-opacity ${isActive ? 'bg-accent-400 opacity-100' : 'opacity-0'}`}
      />
    </button>
  );
}
