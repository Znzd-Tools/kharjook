'use client';

import { Tabs as BaseTabs } from '@base-ui/react/tabs';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface TabItem {
  value: string;
  label: ReactNode;
  /** Optional count badge. */
  count?: number;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Panels keyed by tab value. Omit when tabs only filter content outside. */
  panels?: Record<string, ReactNode>;
  /** Stretch tabs to equal width. Default true. */
  fullWidth?: boolean;
  className?: string;
}

const fa = (n: number) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);

/** Underlined tabs for sub-sections of a page (e.g. وام / چک / اشتراک). */
export function Tabs({ items, panels, fullWidth = true, className, onValueChange, ...props }: TabsProps) {
  return (
    <BaseTabs.Root className={cn('flex flex-col', className)} onValueChange={onValueChange ? (v) => onValueChange(v as string) : undefined} {...props}>
      <BaseTabs.List className="relative flex border-b border-line">
        {items.map((t) => (
          <BaseTabs.Tab
            key={t.value}
            value={t.value}
            disabled={t.disabled}
            className={cn(
              'ds-focus inline-flex h-11 items-center justify-center gap-1.5 px-3 text-callout font-medium whitespace-nowrap text-fg-subtle',
              'transition-colors hover:text-fg data-active:text-fg data-disabled:opacity-45',
              fullWidth && 'flex-1'
            )}
          >
            {t.label}
            {t.count != null && (
              <span className="rounded-full bg-hover px-1.5 text-micro tabular text-fg-muted">{fa(t.count)}</span>
            )}
          </BaseTabs.Tab>
        ))}
        <BaseTabs.Indicator
          className={cn(
            'absolute bottom-[-1px] h-0.5 rounded-full bg-accent',
            'left-(--active-tab-left) w-(--active-tab-width)',
            'transition-[left,width] duration-(--ds-duration-base) ease-emphasized'
          )}
        />
      </BaseTabs.List>
      {panels &&
        items.map((t) => (
          <BaseTabs.Panel key={t.value} value={t.value} className="ds-focus pt-4 outline-none">
            {panels[t.value]}
          </BaseTabs.Panel>
        ))}
    </BaseTabs.Root>
  );
}
