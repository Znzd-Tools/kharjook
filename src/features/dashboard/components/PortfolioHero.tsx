'use client';

import { RefreshCw } from 'lucide-react';
import { DeltaPill, Money } from '@/shared/components/ui';

const ASSET_COLOR = '#8b8af8';
const CASH_COLOR = '#22d3ee';

/** Net worth headline: the one number people open the app for. */
export function PortfolioHero({
  totalLabel,
  assetsLabel,
  cashLabel,
  assetShare,
  cashShare,
  openPnlLabel,
  openPnlPercent,
  hasOpenPnl,
  isRefreshing,
  onRefresh,
}: {
  totalLabel: string;
  assetsLabel: string;
  cashLabel: string;
  assetShare: number;
  cashShare: number;
  openPnlLabel: string;
  openPnlPercent: number;
  hasOpenPnl: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <section className="px-1 pt-1">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium text-zinc-500">ارزش کل سبد</p>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          aria-label="به‌روزرسانی قیمت‌ها و داده‌ها"
          className="-ml-2 inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[11px] text-zinc-500 hover:bg-white/5 hover:text-zinc-300 disabled:opacity-60"
        >
          <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : undefined} />
          {isRefreshing ? 'در حال به‌روزرسانی' : 'به‌روزرسانی'}
        </button>
      </div>

      <p className="mt-1 text-[2.5rem] leading-[1.15] font-semibold tracking-tight text-zinc-50">
        <Money>{totalLabel}</Money>
      </p>

      {hasOpenPnl && (
        <div className="mt-2 flex items-center gap-2 text-xs">
          <DeltaPill value={openPnlPercent}>
            {openPnlPercent >= 0 ? '+' : ''}
            {openPnlPercent.toFixed(1)}%
          </DeltaPill>
          <Money tone={openPnlPercent >= 0 ? 'positive' : 'negative'} className="font-medium">
            {openPnlLabel}
          </Money>
          <span className="text-zinc-500">سود/زیان باز</span>
        </div>
      )}

      <div className="mt-5 flex h-2 gap-0.5 overflow-hidden rounded-full bg-white/6">
        {assetShare > 0 && (
          <div className="h-full rounded-full" style={{ width: `${assetShare}%`, backgroundColor: ASSET_COLOR }} />
        )}
        {cashShare > 0 && (
          <div className="h-full rounded-full" style={{ width: `${cashShare}%`, backgroundColor: CASH_COLOR }} />
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <Legend color={ASSET_COLOR} label="دارایی‌ها" value={assetsLabel} percent={assetShare} />
        <Legend color={CASH_COLOR} label="نقد" value={cashLabel} percent={cashShare} />
      </div>
    </section>
  );
}

function Legend({
  color,
  label,
  value,
  percent,
}: {
  color: string;
  label: string;
  value: string;
  percent: number;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        {label}
        <Money className="text-zinc-600">
          {percent.toFixed(0)}%
        </Money>
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-zinc-200">
        <Money>{value}</Money>
      </p>
    </div>
  );
}
