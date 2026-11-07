'use client';

import { Collapsible } from '@base-ui/react/collapsible';
import { ChevronDown } from '../icons';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface DisclosureProps {
  title: ReactNode;
  /** Short summary shown when closed (e.g. current values). */
  summary?: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
  className?: string;
}

/**
 * Hides advanced options until needed (progressive disclosure).
 * Use in forms for note, fee, tags, repeat — keep the main form short.
 */
export function Disclosure({ title, summary, children, className, onOpenChange, ...props }: DisclosureProps) {
  return (
    <Collapsible.Root className={cn('flex flex-col', className)} onOpenChange={onOpenChange ? (o) => onOpenChange(o) : undefined} {...props}>
      <Collapsible.Trigger className="ds-focus group flex min-h-11 w-full items-center gap-2 rounded-control px-1 text-start">
        <span className="flex-1 text-callout font-medium text-fg-muted">{title}</span>
        {summary && <span className="truncate text-caption text-fg-subtle group-data-panel-open:hidden">{summary}</span>}
        <ChevronDown className="size-4 shrink-0 text-fg-subtle transition-transform duration-(--ds-duration-base) group-data-panel-open:rotate-180" />
      </Collapsible.Trigger>
      <Collapsible.Panel
        className={cn(
          'h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-(--ds-duration-base) ease-standard',
          'data-starting-style:h-0 data-ending-style:h-0'
        )}
      >
        <div className="pt-2 pb-1">{children}</div>
      </Collapsible.Panel>
    </Collapsible.Root>
  );
}
