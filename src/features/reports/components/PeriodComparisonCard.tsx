'use client';

import { Amount, Badge, List, ListRow, Section } from '@/design-system';
import type { CurrencyMode } from '@/shared/types/domain';
import type { CompareMetric } from '@/features/reports/utils/period-comparison';
import { toPersianDigits } from '@/shared/utils/format-display-number';

function deltaLabel(deltaPct: number | null): string {
  if (deltaPct == null) return 'جدید';
  if (deltaPct === 0) return '۰٪';
  return `${deltaPct > 0 ? '+' : '−'}${toPersianDigits(Math.abs(deltaPct).toFixed(0))}٪`;
}

function deltaTone(metric: CompareMetric): 'neutral' | 'positive' | 'negative' {
  if (metric.deltaPct == null || metric.deltaPct === 0) return 'neutral';
  const improved = metric.higherIsBetter ? metric.deltaPct > 0 : metric.deltaPct < 0;
  return improved ? 'positive' : 'negative';
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
    <Section title={title} description={subtitle}>
      <List>
        {metrics.map((metric) => (
          <ListRow
            key={metric.key}
            chevron={false}
            title={metric.label}
            subtitle={
              <span className="inline-flex items-center gap-1">
                <Amount value={metric.current} currency={currencyMode} size="xs" compact />
                <span aria-label="در برابر">←</span>
                <Amount value={metric.previous} currency={currencyMode} size="xs" compact />
              </span>
            }
            trailing={<Badge tone={deltaTone(metric)} size="md"><span dir="ltr">{deltaLabel(metric.deltaPct)}</span></Badge>}
          />
        ))}
      </List>
    </Section>
  );
}
