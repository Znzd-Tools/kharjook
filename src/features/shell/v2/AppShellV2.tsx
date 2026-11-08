'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Fab, Spinner, TabBar, type TabBarItem } from '@/design-system';
import { RefreshCw } from '@/design-system/icons';
import { usePullToRefresh } from './use-pull-to-refresh';
import { CalendarDays, Home, PieChart, Receipt } from '@/design-system/icons';
import { useData } from '@/features/portfolio/PortfolioProvider';
import { countDueSoon } from '@/features/deadlines/utils/due-soon';
import { todayJalaali } from '@/shared/utils/jalali';
import { PwaInstallPrompt } from '@/shared/components/PwaInstallPrompt';
import { RouteTransitionBar } from '@/shared/components/RouteTransitionBar';
import { isTabRoot, tabForPath, TABS } from './nav-config';
import { QuickAddActions } from './QuickAddActions';
import { TabHeader } from './TabHeader';
import { GlobalSearch } from '@/features/search/GlobalSearch';

const ICONS = {
  home: <Home />,
  ledger: <Receipt />,
  portfolio: <PieChart />,
  plan: <CalendarDays />,
} as const;

/**
 * v2 shell: no global header. Four tabs + center "+" (tap = expense,
 * long press = every type). Each tab root shows its own header.
 */
export function AppShellV2({ children, modal }: { children: ReactNode; modal: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { upcomingDeadlines, checks, activeSubscriptions, refresh } = useData();
  const mainRef = useRef<HTMLElement>(null);
  const ptr = usePullToRefresh(mainRef, async () => {
    await refresh();
    router.refresh();
  });
  const [quickOpen, setQuickOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const tab = tabForPath(pathname);
  const root = isTabRoot(pathname);
  const dueSoon = useMemo(
    () =>
      countDueSoon(
        [
          ...(upcomingDeadlines ?? []).map((i) => ({ due: i.due_date_string })),
          ...(checks ?? []).filter((c) => c.status === 'pending').map((c) => ({ due: c.due_date_string })),
          ...(activeSubscriptions ?? []).map((s) => ({ due: s.next_due_date_string })),
        ],
        todayJalaali()
      ),
    [upcomingDeadlines, checks, activeSubscriptions]
  );

  const items: TabBarItem[] = TABS.map((t) => ({
    key: t.key,
    label: t.label,
    href: t.href,
    icon: ICONS[t.key],
    badge: t.key === 'plan' ? dueSoon : undefined,
  }));

  return (
    <div className="flex min-h-dvh justify-center bg-canvas font-sans text-fg">
      <div className="relative flex h-dvh w-full flex-col overflow-hidden bg-canvas sm:max-w-md sm:border-x sm:border-line">
        <RouteTransitionBar />
        <PwaInstallPrompt />
        {(ptr.pull > 0 || ptr.busy) && (
          <div
            aria-live="polite"
            aria-label={ptr.busy ? 'در حال به‌روزرسانی' : ptr.ready ? 'رها کن تا به‌روز شود' : 'برای به‌روزرسانی بکش'}
            className="pointer-events-none absolute inset-x-0 top-0 z-(--ds-z-sticky) flex justify-center"
            style={{ transform: `translateY(${Math.max(ptr.pull - 36, 8)}px)` }}
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-elevated text-accent-ink shadow-raised">
              {ptr.busy ? (
                <Spinner size="sm" />
              ) : (
                <RefreshCw className="size-4.5 transition-transform" style={{ transform: `rotate(${ptr.pull * 3}deg)`, opacity: ptr.ready ? 1 : 0.6 }} aria-hidden />
              )}
            </span>
          </div>
        )}
        <main
          ref={mainRef}
          data-app-scroll="main"
          style={ptr.pull ? { transform: `translateY(${ptr.pull * 0.4}px)` } : undefined}
          className={root ? 'relative flex-1 overflow-x-hidden overflow-y-auto scrollbar-hide pb-28' : 'relative flex-1 overflow-x-hidden overflow-y-auto scrollbar-hide'}
        >
          {root && tab && <TabHeader tab={tab} pathname={pathname} onSearch={() => setSearchOpen(true)} />}
          {children}
        </main>
        {modal}
        {root && (
          <TabBar
            className="absolute inset-x-0 bottom-0"
            activeKey={tab?.key ?? 'home'}
            items={items}
            renderLink={(item, inner, className) => (
              <Link href={item.href!} className={className} aria-current={item.key === tab?.key ? 'page' : undefined}>
                {inner}
              </Link>
            )}
            center={
              <Fab
                aria-label="ثبت هزینه (نگه دار برای همه انواع)"
                onPress={() => router.push('/transactions/new?type=EXPENSE')}
                onLongPress={() => setQuickOpen(true)}
              />
            }
          />
        )}
        <QuickAddActions open={quickOpen} onOpenChange={setQuickOpen} />
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </div>
  );
}
