'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Avatar, Badge, Button, List, ListRow, Section } from '@/design-system';
import { Target } from '@/design-system/icons';
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
    <Section
      title="انحراف از اهداف"
      description={`${toPersianDigits(driftRows.length)} مورد نیاز به تنظیم دارد`}
      action={
        <Button variant="link" size="sm" onClick={() => router.push('/manage/goals')}>
          اهداف
        </Button>
      }
    >
      <List>
        {driftRows.map((row) => (
          <ListRow
            key={row.id}
            chevron={false}
            leading={<Avatar size="sm" tone="lilac" fallback={<Target />} />}
            title={
              <span>
                {row.name} <span className="font-normal text-fg-subtle">· {row.kindLabel}</span>
              </span>
            }
            subtitle={
              <span className="flex flex-col">
                <span dir="ltr" className="text-start tabular">
                  {formatAxis(row)}
                </span>
                {row.actionSuggestion && <span className="text-accent-ink">{row.actionSuggestion}</span>}
              </span>
            }
            trailing={<Badge tone="warning">{row.deltaLabel}</Badge>}
          />
        ))}
      </List>
    </Section>
  );
}
