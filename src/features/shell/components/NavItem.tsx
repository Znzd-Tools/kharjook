'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { haptic } from '@/shared/utils/haptics';

export interface NavItemProps {
  href: string;
  icon: ReactNode;
  label: string;
  isActive: boolean;
}

export function NavItem({ href, icon, label, isActive }: NavItemProps) {
  return (
    <Link
      href={href}
      onClick={() => haptic('selection')}
      aria-current={isActive ? 'page' : undefined}
      className={`flex flex-col items-center gap-1 py-1.5 transition-colors active:scale-95 ${
        isActive ? 'text-zinc-50' : 'text-zinc-500 hover:text-zinc-300'
      }`}
    >
      {icon}
      <span className={`text-[11px] ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
    </Link>
  );
}
