'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Grid2x2, Settings } from 'lucide-react';
import { useUI } from '@/features/portfolio/PortfolioProvider';
import { BottomNav } from '@/features/shell/components/BottomNav';
import { MoreHubSheet } from '@/features/shell/components/MoreHubSheet';
import { PwaInstallPrompt } from '@/shared/components/PwaInstallPrompt';
import { RouteTransitionBar } from '@/shared/components/RouteTransitionBar';
import { haptic } from '@/shared/utils/haptics';

const TAB_ROUTES = new Set<string>(['/', '/assets', '/wallets', '/deadlines']);

const ICON_BUTTON =
  'w-9 h-9 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-white/5 transition-colors';

export interface ShellProps {
  children: ReactNode;
  modal: ReactNode;
}

export function Shell({ children, modal }: ShellProps) {
  const { currencyMode, toggleCurrency } = useUI();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const showNav =
    TAB_ROUTES.has(pathname) ||
    pathname === '/deadlines/loans' ||
    pathname === '/deadlines/persons' ||
    pathname === '/deadlines/checks';

  return (
    <div className="bg-background text-zinc-200 min-h-dvh font-sans flex justify-center">
      <div className="w-full sm:max-w-md bg-surface-shell relative flex flex-col h-dvh overflow-hidden sm:border-x border-white/5">
        <RouteTransitionBar />
        <header className="px-5 pb-3 pt-safe flex justify-between items-center bg-surface-shell/80 backdrop-blur-md border-b border-white/5 z-10">
          <Link
            href="/"
            onClick={() => haptic('selection')}
            className="flex items-center gap-2.5"
          >
            <span className="w-8 h-8 rounded-xl bg-accent-600 text-white flex items-center justify-center text-sm font-semibold">
              خ
            </span>
            <h1 className="text-base font-semibold text-zinc-50 tracking-tight">خرجوک</h1>
          </Link>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                haptic('selection');
                toggleCurrency();
              }}
              aria-label="تغییر واحد نمایش: تومان یا دلار"
              className="flex items-center bg-white/5 p-0.5 rounded-full ml-1"
            >
              {(['TOMAN', 'USD'] as const).map((mode) => (
                <span
                  key={mode}
                  className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                    currencyMode === mode ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400'
                  }`}
                >
                  {mode === 'TOMAN' ? 'تومان' : 'دلار'}
                </span>
              ))}
            </button>
            <button
              type="button"
              onClick={() => {
                haptic('selection');
                setMoreOpen(true);
              }}
              aria-label="منوی بیشتر"
              className={ICON_BUTTON}
            >
              <Grid2x2 size={18} strokeWidth={1.75} />
            </button>
            <Link
              href="/settings"
              onClick={() => haptic('selection')}
              aria-label="تنظیمات"
              className={ICON_BUTTON}
            >
              <Settings size={18} strokeWidth={1.75} />
            </Link>
          </div>
        </header>

        <PwaInstallPrompt />

        <main
          data-app-scroll="main"
          className="flex-1 overflow-y-auto overflow-x-hidden relative scrollbar-hide pb-24"
        >
          {children}
        </main>

        {modal}

        {showNav && <BottomNav />}
        <MoreHubSheet open={moreOpen} onClose={() => setMoreOpen(false)} />
      </div>
    </div>
  );
}
