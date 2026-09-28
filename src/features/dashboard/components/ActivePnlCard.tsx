'use client';

import { ChevronLeft, TrendingDown, TrendingUp } from 'lucide-react';
import type { CurrencyMode } from '@/shared/types/domain';
import { formatCurrency } from '@/shared/utils/format-currency';
import { formatDisplayNumber } from '@/shared/utils/format-display-number';

export interface ActivePnlMover {
  id: string;
  name: string;
  /** Open P/L in the display currency. */
  value: number;
  /** Open P/L as % of this asset's open cost basis. */
  percent: number;
}

function signed(value: number, currencyMode: CurrencyMode): string {
  return `${value >= 0 ? '+' : ''}${formatCurrency(value, currencyMode)}`;
}

function signedPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

/**
 * Open (active / unrealized) P/L of what you hold right now — the number you
 * can still act on. This-year and from-the-beginning P/L are shown smaller,
 * as context, because they mostly describe the past.
 */
export function ActivePnlCard({
  currencyMode,
  openValue,
  openPercent,
  openCostBasis,
  yearValue,
  allTimeValue,
  movers,
  warning,
  onOpen,
}: {
  currencyMode: CurrencyMode;
  openValue: number;
  openPercent: number;
  openCostBasis: number;
  yearValue: number;
  allTimeValue: number;
  movers: ActivePnlMover[];
  warning?: string | null;
  onOpen?: () => void;
}) {
  const positive = openValue >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  const hasHoldings = openCostBasis > 0;

  return (
    <section
      aria-label="سود و زیان باز"
      className={`relative overflow-hidden rounded-[1.75rem] border p-4 ${
        positive
          ? 'border-emerald-400/20 bg-linear-to-br from-emerald-500/12 via-[#1A1B26] to-[#1A1B26]'
          : 'border-rose-400/20 bg-linear-to-br from-rose-500/12 via-[#1A1B26] to-[#1A1B26]'
      }`}
    >
      <div
        className={`absolute -left-14 -top-14 h-36 w-36 rounded-full blur-3xl ${
          positive ? 'bg-emerald-400/15' : 'bg-rose-400/15'
        }`}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-300 font-semibold">سود/زیان باز</p>
          <p className="text-[10px] text-slate-500 mt-0.5">روی دارایی‌هایی که الان داری</p>
        </div>
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="shrink-0 inline-flex items-center gap-0.5 rounded-lg bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10"
          >
            دارایی‌ها
            <ChevronLeft size={14} />
          </button>
        ) : null}
      </div>

      {hasHoldings ? (
        <div className="relative mt-3 flex items-end justify-between gap-3">
          <p
            className={`min-w-0 truncate text-3xl font-black tracking-tight ${
              positive ? 'text-emerald-300' : 'text-rose-300'
            }`}
            dir="ltr"
          >
            {signed(openValue, currencyMode)}
          </p>
          <span
            className={`mb-1 inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
              positive ? 'bg-emerald-400/15 text-emerald-200' : 'bg-rose-400/15 text-rose-200'
            }`}
            dir="ltr"
          >
            <Icon size={13} />
            {signedPercent(openPercent)}
          </span>
        </div>
      ) : (
        <p className="relative mt-3 text-sm text-slate-500">فعلاً دارایی بازی نداری.</p>
      )}

      {hasHoldings && (
        <p className="relative mt-1 text-[11px] text-slate-500">
          روی سرمایه‌ی{' '}
          <span dir="ltr" className="text-slate-400">
            {formatCurrency(openCostBasis, currencyMode)}
          </span>
        </p>
      )}

      {movers.length > 0 && (
        <ul className="relative mt-3 space-y-1.5">
          {movers.map((row) => {
            const up = row.value >= 0;
            return (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/4 px-3 py-2"
              >
                <span className="min-w-0 truncate text-xs text-slate-200">{row.name}</span>
                <span
                  className={`shrink-0 text-[11px] font-semibold ${
                    up ? 'text-emerald-300' : 'text-rose-300'
                  }`}
                  dir="ltr"
                >
                  {signed(row.value, currencyMode)} · {signedPercent(row.percent)}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="relative mt-3 grid grid-cols-2 gap-2 border-t border-white/5 pt-3">
        <div className="min-w-0">
          <p className="text-[10px] text-slate-500">سود/زیان امسال</p>
          <p
            className={`truncate text-sm font-bold ${
              yearValue >= 0 ? 'text-emerald-300/80' : 'text-rose-300/80'
            }`}
            dir="ltr"
          >
            {signed(yearValue, currencyMode)}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-[10px] text-slate-500">سود/زیان از ابتدا</p>
          <p
            className={`truncate text-sm font-bold ${
              allTimeValue >= 0 ? 'text-emerald-300/80' : 'text-rose-300/80'
            }`}
            dir="ltr"
          >
            {signed(allTimeValue, currencyMode)}
          </p>
        </div>
      </div>

      {warning ? (
        <p className="relative mt-2 text-[10px] text-amber-400/80">{warning}</p>
      ) : null}
    </section>
  );
}

export function formatMissingPriceWarning(
  missingCount: number,
  partialCount: number
): string | null {
  if (missingCount <= 0 && partialCount <= 0) return null;
  const parts: string[] = [];
  if (missingCount > 0) {
    parts.push(`${formatDisplayNumber(missingCount)} دارایی بدون قیمت تاریخی؛`);
  }
  if (partialCount > 0) {
    parts.push(`${formatDisplayNumber(partialCount)} دارایی فقط با سود محقق‌شده.`);
  }
  if (missingCount > 0) parts.push('عدد سال ممکن است ناقص باشد.');
  return parts.join(' ');
}
