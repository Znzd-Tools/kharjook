'use client';

import type { CurrencyMode } from '@/shared/types/domain';
import { formatCurrency } from '@/shared/utils/format-currency';
import type { CompareMetric } from '@/features/reports/utils/period-comparison';
import { toPersianDigits } from '@/shared/utils/format-display-number';

function deltaLabel(deltaPct: number | null): string {
  if (deltaPct == null) return 'جدید';
  if (deltaPct === 0) return '۰٪';
  const sign = deltaPct > 0 ? '+' : '';
  return `${sign}${toPersianDigits(Math.abs(deltaPct).toFixed(0))}٪`;
}

function deltaTone(metric: CompareMetric): string {
  if (metric.deltaPct == null || metric.deltaPct === 0) return 'text-zinc-400';
  const improved = metric.higherIsBetter
    ? metric.deltaPct > 0
    : metric.deltaPct < 0;
  return improved ? 'text-emerald-400' : 'text-rose-400';
}

export function PeriodComparisonCard({
  title,
  subtitle,
  metrics,
  currencyMode,
}: {
  title: string;
  subtitle: string;
  metrics: CompareMetric[];
  currencyMode: CurrencyMode;
}) {
  if (metrics.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/5 bg-surface-raised">
      <div>
        <h3 className="px-4 pt-3.5 text-sm font-medium text-zinc-100">{title}</h3>
        {subtitle ? <p className="px-4 text-xs text-zinc-500 mt-0.5">{subtitle}</p> : null}
      </div>
      <div className="mt-2 divide-y divide-white/5 border-t border-white/5">
        {metrics.map((metric) => (
          <div
            key={metric.key}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-xs text-zinc-300">{metric.label}</p>
              <p className="text-[11px] text-zinc-500 mt-0.5" dir="ltr">
                {formatCurrency(metric.current, currencyMode)}
                <span className="text-zinc-600 mx-1">←</span>
                {formatCurrency(metric.previous, currencyMode)}
              </p>
            </div>
            <span className={`text-xs font-semibold shrink-0 ${deltaTone(metric)}`}>
              {deltaLabel(metric.deltaPct)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
