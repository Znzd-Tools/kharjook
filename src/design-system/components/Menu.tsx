'use client';

import { Menu as BaseMenu } from '@base-ui/react/menu';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface MenuItem {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  onSelect: () => void;
}

export interface MenuProps {
  /** Usually an `IconButton` with a "more" icon. */
  trigger: ReactElement;
  items: (MenuItem | 'separator')[];
  side?: 'top' | 'bottom';
  align?: 'start' | 'center' | 'end';
}

/** Small dropdown for overflow actions on wide screens or headers. */
export function Menu({ trigger, items, side = 'bottom', align = 'end' }: MenuProps) {
  return (
    <BaseMenu.Root>
      <BaseMenu.Trigger render={trigger} />
      <BaseMenu.Portal>
        <BaseMenu.Positioner side={side} align={align} sideOffset={6} className="z-(--ds-z-popover) outline-none">
          <BaseMenu.Popup
            dir="rtl"
            className={cn(
              'min-w-44 origin-(--transform-origin) rounded-card bg-elevated p-1.5 text-fg shadow-overlay outline-none',
              'transition-[opacity,scale] duration-(--ds-duration-fast) ease-standard',
              'data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0'
            )}
          >
            {items.map((item, i) =>
              item === 'separator' ? (
                <BaseMenu.Separator key={`sep-${i}`} className="mx-2 my-1 h-px bg-line" />
              ) : (
                <BaseMenu.Item
                  key={item.key}
                  disabled={item.disabled}
                  onClick={item.onSelect}
                  className={cn(
                    'flex h-10 cursor-pointer items-center gap-2.5 rounded-control px-3 text-callout outline-none select-none',
                    'data-highlighted:bg-hover data-disabled:opacity-45 [&_svg]:size-4',
                    item.tone === 'danger' ? 'text-negative-ink' : 'text-fg'
                  )}
                >
                  {item.icon && <span className={cn(item.tone !== 'danger' && 'text-fg-muted')}>{item.icon}</span>}
                  {item.label}
                </BaseMenu.Item>
              )
            )}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.Root>
  );
}
