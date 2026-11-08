'use client';

import { useMemo } from 'react';
import { formatJalaali, todayJalaali } from '@/shared/utils/jalali';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import { buildPnlSummary } from '../utils/pnl-summary';
import { PnlCard } from './PnlCard';

/** PnL card wired to the live portfolio data. */
export function PortfolioPnlCard({ className }: { className?: string }) {
  const { assets, transactions, dailyPrices } = useData();
  const { usdRate } = useUI();
  const todayStr = formatJalaali(todayJalaali());
  const summary = useMemo(
    () => buildPnlSummary(assets, transactions, dailyPrices, usdRate, todayStr),
    [assets, transactions, dailyPrices, usdRate, todayStr]
  );
  if (assets.length === 0) return null;
  return <PnlCard summary={summary} href="/pnl" className={className} />;
}
