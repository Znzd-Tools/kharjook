'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { cn } from '../lib/cn';

const AmountPendingContext = createContext(false);

/**
 * While `pending`, every `Amount` and `Delta` inside shows a shimmer instead
 * of a number. Use it while the numbers are not final yet (data still loading),
 * so the user never sees a number that changes a second later.
 */
export function AmountPendingProvider({ pending, children }: { pending: boolean; children: ReactNode }) {
  return <AmountPendingContext.Provider value={pending}>{children}</AmountPendingContext.Provider>;
}

/** Amount components read this; `live` amounts (typed input, fixed values) opt out. */
export function useAmountPending(live?: boolean): boolean {
  const pending = useContext(AmountPendingContext);
  return pending && !live;
}

/** Inline shimmer with about the width of a number at the current font size. */
export function NumberShimmer({ width = '6ch', className }: { width?: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block h-[0.85em] animate-ds-shimmer rounded-full bg-hover align-middle', className)}
      style={{ width }}
    />
  );
}
