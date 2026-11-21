'use client';

import type { ReactNode } from 'react';
import { AmountPendingProvider } from '@/design-system';
import { useData } from './PortfolioProvider';

/** Amounts shimmer until the portfolio numbers are final (see `isDataSettled`). */
export function AmountsSettledGate({ children }: { children: ReactNode }) {
  const { isDataSettled } = useData();
  return <AmountPendingProvider pending={!isDataSettled}>{children}</AmountPendingProvider>;
}
