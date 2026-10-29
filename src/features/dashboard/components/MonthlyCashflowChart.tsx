'use client';

import type { CurrencyMode } from '@/shared/types/domain';
import { formatCurrency } from '@/shared/utils/format-currency';
import { Card, Money, Section } from '@/shared/components/ui';
import type { MonthCashflowPoint } from '@/features/dashboard/utils/year-cashflow';

export interface MonthlyCashflowChartProps {
  months: MonthCashflowPoint[];
  currencyMode: CurrencyMode;
  yearLabel: string;
}

export function MonthlyCashflowChart({ months, currencyMode, yearLabel }: MonthlyCashflowChartProps) {
  const maxValue = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalExpense = months.reduce((s, m) => s + m.expense, 0);

  return (
    <Section title={`روند ${yearLabel}`} action={{ label: 'گزارش کامل', href: '/reports/cashflow' }}>
      <Card>
        <div className="mb-5 flex items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 text-zinc-500">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            درآمد
            <Money className="font-medium text-zinc-200">{formatCurrency(totalIncome, currencyMode)}</Money>
          </span>
          <span className="inline-flex items-center gap-1.5 text-zinc-500">
            <span className="h-2 w-2 rounded-full bg-rose-400" />
            هزینه
            <Money className="font-medium text-zinc-200">{formatCurrency(totalExpense, currencyMode)}</Money>
          </span>
        </div>

        {months.length === 0 ? (
          <p className="py-10 text-center text-xs text-zinc-500">تراکنش درآمد/هزینه‌ای ثبت نشده.</p>
        ) : (
          <div className="flex h-32 items-end gap-1" dir="ltr">
            {months.map((point) => (
              <div key={point.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div className="flex h-24 w-full items-end justify-center gap-[3px]">
                  <Bar value={point.income} max={maxValue} className="bg-emerald-400" title={`درآمد: ${formatCurrency(point.income, currencyMode)}`} />
                  <Bar value={point.expense} max={maxValue} className="bg-rose-400" title={`هزینه: ${formatCurrency(point.expense, currencyMode)}`} />
                </div>
                <span className="w-full truncate text-center text-[10px] text-zinc-500">{point.label}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Section>
  );
}

function Bar({ value, max, className, title }: { value: number; max: number; className: string; title: string }) {
  const h = (value / max) * 100;
  return (
    <div
      className={`w-[38%] max-w-2.5 rounded-full ${className}`}
      style={{ height: `${Math.max(value > 0 ? 4 : 0, h)}%` }}
      title={title}
    />
  );
}
