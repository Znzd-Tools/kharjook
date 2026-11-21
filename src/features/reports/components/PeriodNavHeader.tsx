'use client';

import { Button, IconButton, SegmentedControl, Text } from '@/design-system';
import { ChevronLeft, ChevronRight } from '@/design-system/icons';
import {
  currentPeriod,
  encodePeriodParams,
  formatPeriodLabel,
  isCurrentPeriod,
  PERIOD_KINDS,
  shiftPeriod,
  type Period,
  type PeriodKind,
  formatPeriodKindLabel,
} from '@/shared/utils/period';

interface PeriodNavHeaderProps {
  period: Period;
  onChange: (next: Period) => void;
}

export function PeriodNavHeader({ period, onChange }: PeriodNavHeaderProps) {
  const onKind = (kind: PeriodKind) => {
    // When switching granularity, anchor on the current period's start so the
    // view stays centered on the same "now moment" the user was looking at.
    if (kind === period.kind) return;
    onChange(currentPeriod(kind));
  };

  const atCurrent = isCurrentPeriod(period);
  const isAllPeriod = period.kind === 'all';

  return (
    <div className="space-y-3">
      <SegmentedControl<PeriodKind>
        aria-label="بازه"
        value={period.kind}
        onValueChange={onKind}
        options={PERIOD_KINDS.map((k) => ({ value: k, label: formatPeriodKindLabel(k) }))}
      />
      <div className="flex items-center gap-2">
        <IconButton aria-label="قبلی" icon={<ChevronRight />} disabled={isAllPeriod} onClick={() => onChange(shiftPeriod(period, -1))} />
        <div className="flex flex-1 flex-col items-center">
          <Text variant="callout" weight="semibold">
            {formatPeriodLabel(period)}
          </Text>
          {!atCurrent && !isAllPeriod && (
            <Button variant="link" size="sm" onClick={() => onChange(currentPeriod(period.kind))}>
              برگشت به {formatPeriodKindLabel(period.kind)} جاری
            </Button>
          )}
          {atCurrent && !isAllPeriod && (
            <Text variant="caption" tone="subtle">
              {formatPeriodKindLabel(period.kind)} جاری
            </Text>
          )}
          {isAllPeriod && (
            <Text variant="caption" tone="subtle">
              همه‌ی تاریخچه
            </Text>
          )}
        </div>
        <IconButton aria-label="بعدی" icon={<ChevronLeft />} disabled={isAllPeriod} onClick={() => onChange(shiftPeriod(period, 1))} />
      </div>
    </div>
  );
}

// Keep the helper in scope for consumers that need to push URL state.
export function periodToSearchParams(p: Period): URLSearchParams {
  const { period, d } = encodePeriodParams(p);
  return new URLSearchParams({ period, d });
}
