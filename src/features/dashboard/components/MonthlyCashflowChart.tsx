'use client';

import { ArrowDownCircle, ArrowUpCircle, ChevronLeft } from 'lucide-react';
import type { CurrencyMode } from '@/shared/types/domain';
import { formatCurrency } from '@/shared/utils/format-currency';
import type { MonthCashflowPoint } from '@/features/dashboard/utils/year-cashflow';

export interface MonthlyCashflowChartProps {
  months: MonthCashflowPoint[];
  currencyMode: CurrencyMode;
  yearLabel: string;
  onOpenReports?: () => void;
}

export function MonthlyCashflowChart({
  months,
  currencyMode,
  yearLabel,
  onOpenReports,
}: MonthlyCashflowChartProps) {
  const maxValue = Math.max(
    1,
    ...months.flatMap((m) => [m.income, m.expense])
  );

  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpense = months.reduce((s, m) => s + m.expense, 0);

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/5 bg-[#1A1B26] p-4">
      <div className="absolute -left-16 top-0 h-40 w-40 rounded-full bg-emerald-500/5 blur-3xl" />
      <div className="absolute -right-16 bottom-0 h-40 w-40 rounded-full bg-rose-500/5 blur-3xl" />

      <div className="relative mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-white">درآمد و هزینه</p>
          <p className="mt-1 text-[11px] text-slate-500">{yearLabel}</p>
        </div>
        {onOpenReports && (
          <button
            type="button"
            onClick={onOpenReports}
            className="flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 shrink-0"
          >
            گزارش کامل
            <ChevronLeft size={14} />
          </button>
        )}
      </div>

      <div className="relative mb-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-3 py-2">
          <div className="flex items-center gap-1.5 text-emerald-300 mb-1">
            <ArrowUpCircle size={13} />
            <span className="text-[10px]">جمع درآمد</span>
          </div>
          <p className="text-sm font-bold text-white" dir="ltr">
            {formatCurrency(totalIncome, currencyMode)}
          </p>
        </div>
        <div className="rounded-xl border border-rose-500/15 bg-rose-500/5 px-3 py-2">
          <div className="flex items-center gap-1.5 text-rose-300 mb-1">
            <ArrowDownCircle size={13} />
            <span className="text-[10px]">جمع هزینه</span>
          </div>
          <p className="text-sm font-bold text-white" dir="ltr">
            {formatCurrency(totalExpense, currencyMode)}
          </p>
        </div>
      </div>

      {months.length === 0 ? (
        <p className="text-center text-xs text-slate-500 py-10">تراکنش درآمد/هزینه‌ای ثبت نشده.</p>
      ) : (
        <>
          <div className="relative flex items-end gap-1.5 sm:gap-2 h-36" dir="ltr">
            {months.map((point) => {
              const incomeH = (point.income / maxValue) * 100;
              const expenseH = (point.expense / maxValue) * 100;
              return (
                <div
                  key={point.month}
                  className="flex flex-1 min-w-0 flex-col items-center gap-1.5"
                >
                  <div className="flex w-full items-end justify-center gap-0.5 h-28">
                    <div
                      className="w-[42%] max-w-5 rounded-t-md bg-emerald-500/85 transition-all"
                      style={{ height: `${Math.max(point.income > 0 ? 4 : 0, incomeH)}%` }}
                      title={`درآمد: ${formatCurrency(point.income, currencyMode)}`}
                    />
                    <div
                      className="w-[42%] max-w-5 rounded-t-md bg-rose-500/85 transition-all"
                      style={{ height: `${Math.max(point.expense > 0 ? 4 : 0, expenseH)}%` }}
                      title={`هزینه: ${formatCurrency(point.expense, currencyMode)}`}
                    />
                  </div>
                  <span className="w-full truncate text-center text-[9px] sm:text-[10px] text-slate-500">
                    {point.label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-emerald-500/85" />
              درآمد
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-rose-500/85" />
              هزینه
            </span>
          </div>
        </>
      )}
    </div>
  );
}
