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
  if (metric.deltaPct == null || metric.deltaPct === 0) return 'text-slate-400';
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
    <section className="bg-[#1A1B26] border border-white/5 rounded-2xl p-4 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="space-y-2">
        {metrics.map((metric) => (
          <div
            key={metric.key}
            className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-xs text-slate-300">{metric.label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5" dir="ltr">
                {formatCurrency(metric.current, currencyMode)}
                <span className="text-slate-600 mx-1">←</span>
                {formatCurrency(metric.previous, currencyMode)}
              </p>
            </div>
            <span className={`text-xs font-bold shrink-0 ${deltaTone(metric)}`}>
              {deltaLabel(metric.deltaPct)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
