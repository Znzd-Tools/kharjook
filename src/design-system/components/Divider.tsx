import { Separator } from '@base-ui/react/separator';
import { cn } from '../lib/cn';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  /** Indent from the start edge (to align with list text after an icon). */
  inset?: boolean;
  /** Optional text in the middle, e.g. "یا". */
  label?: string;
  className?: string;
}

export function Divider({ orientation = 'horizontal', inset, label, className }: DividerProps) {
  if (label) {
    return (
      <div className={cn('flex items-center gap-3 text-caption text-fg-subtle', className)} role="separator">
        <span className="h-px flex-1 bg-line" />
        {label}
        <span className="h-px flex-1 bg-line" />
      </div>
    );
  }
  return (
    <Separator
      orientation={orientation}
      className={cn(
        'shrink-0 bg-line',
        orientation === 'horizontal' ? 'h-px w-auto' : 'w-px self-stretch',
        inset && 'ms-15',
        className
      )}
    />
  );
}
