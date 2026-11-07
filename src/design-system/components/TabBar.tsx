'use client';

import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { haptic } from '../lib/haptics';
import { CounterBadge } from './Badge';

export interface TabBarItem {
  key: string;
  label: string;
  icon: ReactNode;
  /** Filled icon for the active state (optional). */
  activeIcon?: ReactNode;
  badge?: number;
  /** Render as link: pass a Next `Link` via `renderLink`. */
  href?: string;
}

export interface TabBarProps {
  items: TabBarItem[];
  activeKey: string;
  onSelect?: (key: string) => void;
  /** Center slot, usually `<Fab />`. Splits items in two halves. */
  center?: ReactNode;
  /** Render function for links (keeps the DS free of next/link). */
  renderLink?: (item: TabBarItem, children: ReactNode, className: string) => ReactNode;
  className?: string;
}

/** Bottom navigation: 4 tabs + center action. */
export function TabBar({ items, activeKey, onSelect, center, renderLink, className }: TabBarProps) {
  const half = Math.ceil(items.length / 2);
  const renderItem = (item: TabBarItem) => {
    const active = item.key === activeKey;
    const cls = cn(
      'ds-focus relative flex flex-1 flex-col items-center justify-center gap-1 rounded-control py-1.5 text-micro select-none',
      'transition-colors duration-(--ds-duration-fast)',
      active ? 'text-fg' : 'text-fg-subtle hover:text-fg-muted'
    );
    const inner = (
      <>
        <span
          className={cn(
            'relative flex h-8 w-14 items-center justify-center rounded-full transition-colors duration-(--ds-duration-base) [&_svg]:size-6',
            active ? 'bg-accent-soft text-accent-ink' : ''
          )}
        >
          {active && item.activeIcon ? item.activeIcon : item.icon}
          {item.badge ? <CounterBadge count={item.badge} className="absolute -top-1 -end-2" /> : null}
        </span>
        <span className={cn(active && 'font-semibold')}>{item.label}</span>
      </>
    );
    if (item.href && renderLink) return <li key={item.key} className="flex flex-1">{renderLink(item, inner, cls)}</li>;
    return (
      <li key={item.key} className="flex flex-1">
        <button
          type="button"
          aria-current={active ? 'page' : undefined}
          onClick={() => {
            haptic('selection');
            onSelect?.(item.key);
          }}
          className={cls}
        >
          {inner}
        </button>
      </li>
    );
  };
  return (
    <nav
      aria-label="ناوبری اصلی"
      className={cn(
        'z-(--ds-z-nav) bg-canvas/85 px-2 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xl',
        className
      )}
    >
      <ul className="flex h-(--ds-tabbar-height) items-center">
        {items.slice(0, center ? half : items.length).map(renderItem)}
        {center && <li className="flex shrink-0 items-center justify-center px-2">{center}</li>}
        {center && items.slice(half).map(renderItem)}
      </ul>
    </nav>
  );
}
