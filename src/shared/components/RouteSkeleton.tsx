'use client';

import { Skeleton } from '@/design-system';

/** Page placeholder while a route loads. */
export function RouteSkeleton({ blocks = 4, compact = false }: { blocks?: number; compact?: boolean }) {
  return (
    <div className={`space-y-3 px-(--ds-gutter) ${compact ? 'pt-3' : 'pt-6'}`}>
      <Skeleton className="h-8 w-40 rounded-control" />
      {Array.from({ length: blocks }).map((_, index) => (
        <Skeleton key={index} className={`rounded-card ${index % 3 === 0 ? 'h-24' : index % 3 === 1 ? 'h-20' : 'h-28'}`} />
      ))}
    </div>
  );
}
