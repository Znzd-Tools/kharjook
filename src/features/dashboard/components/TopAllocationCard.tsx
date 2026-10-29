'use client';

import type { CurrencyMode } from '@/shared/types/domain';
import { formatCurrency } from '@/shared/utils/format-currency';

const PALETTE = ['#7470f1', '#06b6d4', '#22c55e'];

export interface TopAllocationBar {
  name: string;
  value: number;
  percent: number;
}

export function TopAllocationCard({
  rows,
  currencyMode,
}: {
  rows: TopAllocationBar[];
  currencyMode: CurrencyMode;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-surface-raised p-6 text-center text-xs text-zinc-500">
        دارایی‌ای در سبد ثبت نشده.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/5 bg-surface-raised p-4 space-y-3">
      <p className="text-sm font-semibold text-white">بیشترین سهم سبد</p>
      {rows.map((row, index) => (
        <div key={row.name} className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate text-zinc-300">{row.name}</span>
            <span className="shrink-0 text-zinc-400" dir="ltr">
              {formatCurrency(row.value, currencyMode)} · {row.percent.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, row.percent)}%`,
                backgroundColor: PALETTE[index % PALETTE.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
