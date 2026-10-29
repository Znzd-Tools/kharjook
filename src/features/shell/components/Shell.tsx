'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { LayoutGrid, Settings } from 'lucide-react';
import { useUI } from '@/features/portfolio/PortfolioProvider';
import { BottomNav } from '@/features/shell/components/BottomNav';
import { MoreHubSheet } from '@/features/shell/components/MoreHubSheet';
import { tabForPath } from '@/features/shell/utils/tabs';
import { PwaInstallPrompt } from '@/shared/components/PwaInstallPrompt';
import { RouteTransitionBar } from '@/shared/components/RouteTransitionBar';
import { IconButton } from '@/shared/components/ui';
import { haptic } from '@/shared/utils/haptics';

export interface ShellProps {
  children: ReactNode;
  modal: ReactNode;
}

export function Shell({ children, modal }: ShellProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const tab = tabForPath(pathname);

  return (
    <div className="bg-background text-zinc-200 min-h-dvh font-sans flex justify-center">
      <div className="w-full sm:max-w-md bg-surface-shell relative flex flex-col h-dvh overflow-hidden sm:border-x border-white/5">
        <RouteTransitionBar />
        {tab && (
          <header className="px-4 pt-safe pb-2 flex items-center justify-between gap-3 z-10">
            <h1 className="text-[1.375rem] font-semibold tracking-tight text-zinc-50 pr-1">
              {tab.key === 'home' ? 'خرجوک' : tab.title}
            </h1>
            <div className="flex items-center gap-0.5">
              <CurrencyToggle />
              <IconButton
                label="منوی بیشتر"
                onClick={() => {
                  haptic('selection');
                  setMoreOpen(true);
                }}
              >
                <LayoutGrid size={19} strokeWidth={1.75} />
              </IconButton>
              <IconButton label="تنظیمات" href="/settings">
                <Settings size={19} strokeWidth={1.75} />
              </IconButton>
            </div>
          </header>
        )}

        <main
          data-app-scroll="main"
          className={`flex-1 overflow-y-auto overflow-x-hidden relative scrollbar-hide ${tab ? 'pb-28' : 'pb-8'}`}
        >
          {pathname === '/' && <PwaInstallPrompt />}
          {children}
        </main>

        {modal}

        {tab && <BottomNav active={tab.key} />}
        <MoreHubSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      </div>
    </div>
  );
}

function CurrencyToggle() {
  const { currencyMode, toggleCurrency } = useUI();
  return (
    <button
      type="button"
      onClick={() => {
        haptic('selection');
        toggleCurrency();
      }}
      aria-label={`واحد نمایش: ${currencyMode === 'TOMAN' ? 'تومان' : 'دلار'}. برای تغییر بزن.`}
      className="ml-1 flex h-8 items-center gap-1 rounded-full bg-white/6 px-3 text-xs font-medium text-zinc-200 hover:bg-white/10 transition-colors"
    >
      <span className={currencyMode === 'TOMAN' ? 'text-zinc-50' : 'text-zinc-500'}>تومان</span>
      <span className="text-zinc-600">/</span>
      <span className={currencyMode === 'USD' ? 'text-zinc-50' : 'text-zinc-500'}>دلار</span>
    </button>
  );
}
