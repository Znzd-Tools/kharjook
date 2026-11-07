'use client';

import { ArrowRight } from '../icons';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { IconButton } from './IconButton';

export interface TopBarProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Show back arrow. */
  onBack?: () => void;
  backLabel?: string;
  /** Start-side content instead of back (e.g. avatar on Home). */
  leading?: ReactNode;
  /** End-side actions. Max 2 icon buttons. */
  actions?: ReactNode;
  /** `large`: big title under the bar (tab root pages). `inline`: title in the bar (sub pages). */
  variant?: 'inline' | 'large';
  /** Blur + border when content scrolls under it. */
  sticky?: boolean;
  className?: string;
}

/**
 * Page header. Replaces the global app header: each page owns its title.
 * Root tabs use `large`, pushed pages use `inline` with `onBack`.
 */
export function TopBar({
  title,
  subtitle,
  onBack,
  backLabel = 'بازگشت',
  leading,
  actions,
  variant = 'inline',
  sticky = true,
  className,
}: TopBarProps) {
  const start = onBack ? <IconButton aria-label={backLabel} icon={<ArrowRight />} onClick={onBack} /> : leading;
  return (
    <header
      className={cn(
        'z-(--ds-z-sticky) bg-canvas/85 px-(--ds-gutter) pt-[env(safe-area-inset-top,0px)] backdrop-blur-xl',
        sticky && 'sticky top-0',
        className
      )}
    >
      <div className="flex h-(--ds-topbar-height) items-center gap-2">
        {start && <div className="-ms-2 flex shrink-0 items-center">{start}</div>}
        <div className="min-w-0 flex-1">
          {variant === 'inline' && title && (
            <>
              <h1 className="truncate text-body font-semibold text-fg">{title}</h1>
              {subtitle && <p className="truncate text-micro text-fg-subtle">{subtitle}</p>}
            </>
          )}
        </div>
        {actions && <div className="-me-2 flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      {variant === 'large' && title && (
        <div className="pb-3">
          <h1 className="text-headline text-fg">{title}</h1>
          {subtitle && <p className="text-caption text-fg-subtle">{subtitle}</p>}
        </div>
      )}
    </header>
  );
}
