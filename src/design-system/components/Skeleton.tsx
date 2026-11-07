import { cn } from '../lib/cn';

export interface SkeletonProps {
  className?: string;
  /** Shape preset. */
  shape?: 'text' | 'rect' | 'circle';
}

/** Loading placeholder. Size it with className (w-*, h-*). */
export function Skeleton({ className, shape = 'rect' }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className={cn(
        'block animate-ds-shimmer bg-hover',
        shape === 'text' && 'h-3 w-24 rounded-full',
        shape === 'rect' && 'h-16 w-full rounded-card',
        shape === 'circle' && 'size-10 rounded-full',
        className
      )}
    />
  );
}

/** Placeholder for a list of rows. */
export function SkeletonList({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div role="status" aria-label="در حال بارگذاری" className={cn('overflow-hidden rounded-card bg-panel', className)}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className={cn('flex items-center gap-3 px-4 py-3', i > 0 && 'border-t border-line')}>
          <Skeleton shape="circle" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton shape="text" className="w-28" />
            <Skeleton shape="text" className="h-2.5 w-16" />
          </div>
          <Skeleton shape="text" className="w-20" />
        </div>
      ))}
    </div>
  );
}
