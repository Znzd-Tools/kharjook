import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Usually one `Button`. Max one primary action. */
  action?: ReactNode;
  secondaryAction?: ReactNode;
  className?: string;
  /** Smaller variant for use inside sections. */
  compact?: boolean;
}

/** Shown when a list has no items. Always tell the user the next step. */
export function EmptyState({ icon, title, description, action, secondaryAction, className, compact }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center text-center', compact ? 'gap-2 py-6' : 'gap-3 px-6 py-12', className)}>
      {icon && (
        <div
          className={cn(
            'flex items-center justify-center rounded-card bg-hover text-fg-subtle',
            compact ? 'size-10 [&_svg]:size-5' : 'size-14 [&_svg]:size-6'
          )}
        >
          {icon}
        </div>
      )}
      <div className="space-y-1">
        <p className={cn('font-semibold text-fg', compact ? 'text-callout' : 'text-body')}>{title}</p>
        {description && <p className="mx-auto max-w-xs text-caption text-fg-subtle">{description}</p>}
      </div>
      {(action || secondaryAction) && (
        <div className="mt-1 flex flex-col items-center gap-2">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
