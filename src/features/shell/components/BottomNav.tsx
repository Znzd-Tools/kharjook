'use client';

import Link from 'next/link';
import { ArrowLeftRight, CalendarClock, Home, PieChart, Plus } from 'lucide-react';
import { useData } from '@/features/portfolio/PortfolioProvider';
import { NavItem } from '@/features/shell/components/NavItem';
import type { TabKey } from '@/features/shell/utils/tabs';
import { haptic } from '@/shared/utils/haptics';

const ICON = { size: 22, strokeWidth: 1.75 } as const;

export function BottomNav({ active }: { active: TabKey }) {
  const { isLoadingData } = useData();

  return (
    <nav className="absolute bottom-0 inset-x-0 z-40 border-t border-white/5 bg-surface-shell/90 backdrop-blur-md pb-safe">
      <div className="grid grid-cols-5 items-center px-2 pt-1.5">
        <NavItem href="/" icon={<Home {...ICON} />} label="خانه" isActive={active === 'home'} />
        <NavItem
          href="/assets"
          icon={<PieChart {...ICON} />}
          label="سبد"
          isActive={active === 'portfolio'}
        />
        <div className="flex justify-center">
          <Link
            href="/transactions/new"
            onClick={() => haptic('selection')}
            aria-label="ثبت تراکنش جدید"
            aria-disabled={isLoadingData}
            tabIndex={isLoadingData ? -1 : undefined}
            className={`flex h-12 w-12 items-center justify-center rounded-full bg-zinc-50 text-zinc-900 hover:bg-white transition-transform active:scale-95 ${
              isLoadingData ? 'opacity-50 pointer-events-none' : ''
            }`}
          >
            <Plus size={24} strokeWidth={2.25} />
          </Link>
        </div>
        <NavItem
          href="/transactions"
          icon={<ArrowLeftRight {...ICON} />}
          label="تراکنش‌ها"
          isActive={active === 'transactions'}
        />
        <NavItem
          href="/deadlines"
          icon={<CalendarClock {...ICON} />}
          label="سررسیدها"
          isActive={active === 'deadlines'}
        />
      </div>
    </nav>
  );
}
