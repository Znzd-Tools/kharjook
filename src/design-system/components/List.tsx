'use client';

import { useRender } from '@base-ui/react/use-render';
import { mergeProps } from '@base-ui/react/merge-props';
import { ChevronLeft } from '../icons';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface ListProps {
  children: ReactNode;
  /** `card`: rows inside a panel. `plain`: rows directly on canvas. */
  variant?: 'card' | 'plain';
  /** Divider lines between rows. Default true. */
  dividers?: boolean;
  className?: string;
  'aria-label'?: string;
}

/** Group of `ListRow`s. The default way to show collections. */
export function List({ children, variant = 'card', dividers = true, className, ...props }: ListProps) {
  return (
    <ul
      className={cn(
        'flex flex-col',
        variant === 'card' && 'overflow-hidden rounded-card bg-panel',
        dividers && '[&>li+li>*]:border-t [&>li+li>*]:border-line',
        className
      )}
      {...props}
    >
      {children}
    </ul>
  );
}

export interface ListRowProps extends Omit<useRender.ComponentProps<'div'>, 'title'> {
  /** Icon or Avatar on the start side. */
  leading?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Value on the end side, e.g. an `Amount`. */
  trailing?: ReactNode;
  /** Small text under trailing. */
  trailingSubtitle?: ReactNode;
  /** Show a chevron. Default: true when the row is clickable. */
  chevron?: boolean;
  /** Visual density. */
  size?: 'sm' | 'md';
  disabled?: boolean;
  /** Wrap each row in <li>. Set false when used outside a `List`. Default true. */
  asListItem?: boolean;
}

/**
 * One row: leading · title/subtitle · trailing. Clickable when `onClick`
 * is set or `render={<Link href />}` is used.
 */
export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  trailingSubtitle,
  chevron,
  size = 'md',
  disabled,
  asListItem = true,
  className,
  render,
  onClick,
  ...props
}: ListRowProps) {
  const interactive = Boolean(onClick || render);
  const showChevron = chevron ?? interactive;

  const content = (
    <>
      {leading && <span className="flex shrink-0 items-center">{leading}</span>}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-callout font-medium text-fg">{title}</span>
        {subtitle && <span className="truncate text-caption text-fg-subtle">{subtitle}</span>}
      </span>
      {(trailing || trailingSubtitle) && (
        <span className="flex shrink-0 flex-col items-end text-end">
          {trailing && <span className="text-callout text-fg">{trailing}</span>}
          {trailingSubtitle && <span className="text-caption text-fg-subtle">{trailingSubtitle}</span>}
        </span>
      )}
      {showChevron && <ChevronLeft aria-hidden className="size-4 shrink-0 text-fg-subtle" />}
    </>
  );

  const element = useRender({
    defaultTagName: onClick && !render ? 'button' : 'div',
    render,
    props: mergeProps<'div'>(
      {
        className: cn(
          'flex w-full items-center gap-3 px-4 text-start',
          size === 'md' ? 'min-h-16 py-3' : 'min-h-12 py-2',
          interactive &&
            'ds-focus cursor-pointer transition-colors duration-(--ds-duration-fast) hover:bg-hover active:bg-pressed',
          disabled && 'pointer-events-none opacity-45',
          className
        ),
        onClick,
        children: content,
        ...(onClick && !render ? { type: 'button' } : {}),
      } as React.ComponentProps<'div'>,
      props
    ),
  });

  return asListItem ? <li>{element}</li> : element;
}

export interface ListHeaderProps {
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

/** Sticky group header inside long lists (e.g. a date in the ledger). */
export function ListHeader({ children, trailing, className }: ListHeaderProps) {
  return (
    <div
      className={cn(
        'sticky top-0 z-(--ds-z-sticky) flex items-center justify-between bg-canvas/90 px-1 py-2 text-caption font-medium text-fg-subtle backdrop-blur-md',
        className
      )}
    >
      <span>{children}</span>
      {trailing && <span className="tabular">{trailing}</span>}
    </div>
  );
}
