'use client';

import { useMemo } from 'react';
import { Card, Money, ProgressBar, Section, Stat } from '@/shared/components/ui';
import { useData } from '@/features/portfolio/PortfolioProvider';
import { buildCapStatuses } from '@/features/categories/utils/category-spending-caps';
import { formatCurrency } from '@/shared/utils/format-currency';
import { toPersianDigits } from '@/shared/utils/format-display-number';
import { clampPeriodToToday, currentPeriod } from '@/shared/utils/period';
import type { CurrencyMode } from '@/shared/types/domain';

/** Current month at a glance: in, out, net, top category and spending caps. */
export function MonthSummaryCard({
  monthLabel,
  income,
  expense,
  topExpense,
  currencyMode,
}: {
  monthLabel: string;
  income: number;
  expense: number;
  topExpense: { name: string; value: number } | null;
  currencyMode: CurrencyMode;
}) {
  const { spendingCaps, categories, transactions } = useData();
  const caps = useMemo(() => {
    if (spendingCaps.length === 0) return [];
    const period = clampPeriodToToday(currentPeriod('month'));
    return buildCapStatuses({ caps: spendingCaps, categories, transactions, period }).slice(0, 4);
  }, [spendingCaps, categories, transactions]);

  const net = income - expense;
  const savingRate = income > 0 ? (net / income) * 100 : null;

  return (
    <Section title={monthLabel} action={{ label: 'گزارش', href: '/reports/cashflow' }}>
      <Card className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="درآمد" value={formatCurrency(income, currencyMode)} tone="positive" />
          <Stat label="هزینه" value={formatCurrency(expense, currencyMode)} tone="negative" />
          <Stat
            label="مانده"
            value={`${net >= 0 ? '+' : ''}${formatCurrency(net, currencyMode)}`}
            hint={savingRate != null ? `پس‌انداز ${toPersianDigits(Math.round(savingRate))}٪` : undefined}
          />
        </div>

        {income > 0 && (
          <div className="flex h-1.5 overflow-hidden rounded-full bg-emerald-400/20" dir="rtl">
            <div
              className="h-full rounded-full bg-rose-400"
              style={{ width: `${Math.min(100, (expense / income) * 100)}%` }}
            />
          </div>
        )}

        {topExpense && (
          <p className="text-xs text-zinc-500">
            بیشترین هزینه: <span className="text-zinc-300">{topExpense.name}</span> ·{' '}
            <Money className="text-zinc-300">{formatCurrency(topExpense.value, currencyMode)}</Money>
          </p>
        )}

        {caps.length > 0 && (
          <div className="space-y-3 border-t border-white/5 pt-4">
            <p className="text-xs font-medium text-zinc-400">سقف هزینه</p>
            {caps.map((cap) => (
              <div key={cap.categoryId} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-zinc-300">{cap.categoryName}</span>
                  <span className="shrink-0 text-zinc-500">
                    <Money>{formatCurrency(cap.spentToman, 'TOMAN')}</Money> از{' '}
                    <Money>{formatCurrency(cap.limitToman, 'TOMAN')}</Money>
                  </span>
                </div>
                <ProgressBar
                  value={cap.percent}
                  tone={cap.level === 'over' ? 'negative' : cap.level === 'warn' ? 'warning' : 'positive'}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </Section>
  );
}
