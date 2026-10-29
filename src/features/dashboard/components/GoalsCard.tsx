'use client';

import { Lightbulb } from 'lucide-react';
import { Card, ProgressBar, Section } from '@/shared/components/ui';
import { isGoalMet } from '@/features/goals/utils/goal-progress-display';
import { toPersianDigits } from '@/shared/utils/format-display-number';
import type { HomeGoalRow } from '@/features/dashboard/components/HomeTab';

function formatGoalValue(row: HomeGoalRow, value: number) {
  if (row.valueKind === 'percent') return `${toPersianDigits(value.toFixed(1))}٪`;
  const n = value.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return `${toPersianDigits(n)}${row.unit ? ` ${row.unit}` : ''}`;
}

/** Allocation & quantity targets: current vs target with a marker, plus the next move. */
export function GoalsCard({ rows }: { rows: HomeGoalRow[] }) {
  const metCount = rows.filter((r) => isGoalMet(r.currentValue, r.targetValue, r.valueKind)).length;
  const suggestions = rows.filter((r) => r.buySuggestion);

  return (
    <Section
      title="اهداف"
      description={
        rows.length > 0
          ? `${toPersianDigits(metCount)} از ${toPersianDigits(rows.length)} هدف رسیده`
          : undefined
      }
      action={{ label: rows.length > 0 ? 'مدیریت' : 'تعریف هدف', href: '/manage/goals' }}
    >
      {rows.length === 0 ? (
        <Card>
          <p className="text-xs leading-relaxed text-zinc-500">
            برای گروه یا دارایی درصد یا مقدار هدف بگذار تا ببینی سبدت چقدر با برنامه‌ات فاصله دارد.
          </p>
        </Card>
      ) : (
        <Card className="space-y-4">
          {rows.map((row) => {
            const met = isGoalMet(row.currentValue, row.targetValue, row.valueKind);
            const scale = Math.max(row.targetValue * 1.25, row.currentValue, 1e-9);
            return (
              <div key={row.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate">
                    <span className="text-zinc-200">{row.name}</span>
                    <span className="text-zinc-600"> · {row.kindLabel}</span>
                  </span>
                  <span className="shrink-0 text-zinc-500">
                    <span className={met ? 'text-emerald-400' : 'text-zinc-200'}>
                      {formatGoalValue(row, row.currentValue)}
                    </span>{' '}
                    / {formatGoalValue(row, row.targetValue)}
                  </span>
                </div>
                <ProgressBar
                  value={row.currentValue}
                  max={scale}
                  marker={row.targetValue}
                  tone={met ? 'positive' : 'accent'}
                />
              </div>
            );
          })}

          {suggestions.length > 0 && (
            <div className="space-y-1.5 rounded-xl bg-accent-500/8 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium text-accent-200">
                <Lightbulb size={13} />
                قدم بعدی
              </p>
              <ul className="space-y-1">
                {suggestions.slice(0, 3).map((row) => (
                  <li key={row.id} className="text-xs leading-relaxed text-zinc-300">
                    {row.buySuggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </Section>
  );
}
