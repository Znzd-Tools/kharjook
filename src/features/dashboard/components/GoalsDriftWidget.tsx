'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Target } from 'lucide-react';
import { useData, useUI } from '@/features/portfolio/PortfolioProvider';
import {
  buildGoalDriftRows,
  filterDriftedGoalRows,
  sortGoalDriftRows,
} from '@/features/goals/utils/goal-drift-rows';
import { toPersianDigits } from '@/shared/utils/format-display-number';

function formatAxis(row: { valueKind: 'percent' | 'quantity'; currentValue: number; targetValue: number }) {
  if (row.valueKind === 'percent') {
    return `${row.currentValue.toFixed(1)}% ← ${row.targetValue.toFixed(1)}%`;
  }
  return `${row.currentValue.toLocaleString('en-US')} ← ${row.targetValue.toLocaleString('en-US')}`;
}

export function GoalsDriftWidget() {
  const router = useRouter();
  const { goals, assets, categories, transactions } = useData();
  const { usdRate, currencyMode } = useUI();

  const driftRows = useMemo(() => {
    return sortGoalDriftRows(
      filterDriftedGoalRows(
        buildGoalDriftRows({
          goals,
          assets,
          categories,
          transactions,
          currencyMode,
          usdRate,
        })
      )
    ).slice(0, 5);
  }, [goals, assets, categories, transactions, currencyMode, usdRate]);

  if (driftRows.length === 0) return null;

  return (
    <section className="bg-surface-raised border border-accent-500/15 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-accent-500/10 flex items-center justify-center text-accent-300">
            <Target size={16} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">انحراف از اهداف</h3>
            <p className="text-xs text-zinc-500">
              {toPersianDigits(driftRows.length)} مورد نیازمند تنظیم
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => router.push('/manage/goals')}
          className="text-xs text-accent-400 hover:text-accent-300 inline-flex items-center gap-0.5"
        >
          اهداف
          <ChevronLeft size={14} />
        </button>
      </div>

      <div className="space-y-2">
        {driftRows.map((row) => (
          <div
            key={row.id}
            className="rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5 space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-zinc-200 font-medium truncate">
                {row.name}
                <span className="text-zinc-500 font-normal"> · {row.kindLabel}</span>
              </p>
              <span className="text-[11px] text-amber-300 shrink-0">{row.deltaLabel}</span>
            </div>
            <p className="text-[11px] text-zinc-500" dir="ltr">
              {formatAxis(row)}
            </p>
            {row.actionSuggestion && (
              <p className="text-[11px] text-accent-300/90 leading-relaxed">💡 {row.actionSuggestion}</p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
