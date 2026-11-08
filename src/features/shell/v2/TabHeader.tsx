'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Avatar, IconButton, Menu, SegmentedControl, TopBar, cn } from '@/design-system';
import {
  BarChart3, Coins, LayoutGrid, MoreHorizontal, Percent, Repeat, Settings, Target, TrendingUp, Download, Wallet,
} from '@/design-system/icons';
import { useAuth, useUI } from '@/features/portfolio/PortfolioProvider';
import { haptic } from '@/shared/utils/haptics';
import { isSubNavActive, type MenuLink, type TabConfig } from './nav-config';

const MENU_ICON: Record<MenuLink['icon'], React.ReactNode> = {
  repeat: <Repeat />,
  upload: <Download />,
  grid: <LayoutGrid />,
  target: <Target />,
  settings: <Settings />,
  rate: <Percent />,
  source: <TrendingUp />,
  coins: <Coins />,
  wallet: <Wallet />,
  chart: <BarChart3 />,
};

/** Header for tab root screens: title, sub navigation and one ⋯ menu. */
export function TabHeader({ tab, pathname }: { tab: TabConfig; pathname: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const { currencyMode, setCurrencyMode } = useUI();

  if (tab.key === 'home') {
    return (
      <TopBar
        leading={
          <Link href="/settings" aria-label="تنظیمات" onClick={() => haptic('selection')} className="ds-focus rounded-full">
            <Avatar size="sm" tone="lilac" name={user?.email ?? 'خرجوک'} />
          </Link>
        }
        actions={
          <SegmentedControl
            aria-label="واحد نمایش"
            size="sm"
            fullWidth={false}
            value={currencyMode}
            onValueChange={(v) => {
              haptic('selection');
              setCurrencyMode(v);
            }}
            options={[
              { value: 'TOMAN', label: 'تومان' },
              { value: 'USD', label: 'دلار' },
            ]}
          />
        }
      />
    );
  }

  return (
    <div className="sticky top-0 z-(--ds-z-sticky) bg-canvas/85 backdrop-blur-xl">
      <TopBar
        sticky={false}
        className="bg-transparent backdrop-blur-none"
        title={tab.title}
        actions={
          tab.menu ? (
            <Menu
              trigger={<IconButton aria-label="گزینه‌های بیشتر" icon={<MoreHorizontal />} />}
              items={tab.menu.map((m) => ({
                key: m.href,
                label: m.label,
                icon: MENU_ICON[m.icon],
                onSelect: () => router.push(m.href),
              }))}
            />
          ) : undefined
        }
      />
      {tab.subNav && (
        <nav aria-label={tab.title} className="flex gap-2 overflow-x-auto px-(--ds-gutter) pb-3 scrollbar-hide">
          {tab.subNav.map((item) => {
            const active = isSubNavActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={() => haptic('selection')}
                className={cn(
                  'ds-focus inline-flex h-9 shrink-0 items-center rounded-full px-4 text-caption font-medium transition-colors',
                  active ? 'bg-accent text-fg-on-accent' : 'bg-hover text-fg-muted hover:text-fg'
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
