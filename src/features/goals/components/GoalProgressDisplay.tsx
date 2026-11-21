'use client';

import { Badge, ProgressBar, Text } from '@/design-system';
import { Target } from '@/design-system/icons';
import type { GoalProgress } from '@/features/goals/utils/goal-progress';
import {
  computeGoalBarMetricsForKind,
  computeGoalDelta,
  formatGoalValue,
  goalGapLabel,
  type GoalValueKind,
} from '@/features/goals/utils/goal-progress-display';

export interface GoalProgressDisplayProps {
  label: string;
  progress: GoalProgress | null;
  kind: GoalValueKind;
  /** Unit for quantity goals (e.g. گرم). Ignored for percent. */
  unit?: string;
  variant?: 'compact' | 'default';
  showIcon?: boolean;
  className?: string;
}

/** Goal progress: label, "how far" badge, bar with a target marker. */
export function GoalProgressDisplay({
  label,
  progress,
  kind,
  unit = '',
  variant = 'default',
  showIcon = true,
  className = '',
}: GoalProgressDisplayProps) {
  const valueUnit = kind === 'percent' ? '%' : unit;
  const delta = computeGoalDelta(progress, kind, valueUnit);
  const bar = computeGoalBarMetricsForKind(progress, kind);
  const reached = delta.status !== 'under';
  const hasGoal = !!progress && progress.target > 0;

  const header = (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex min-w-0 items-center gap-1 text-caption text-fg-muted">
        {showIcon && <Target className="size-3.5 shrink-0" aria-hidden />}
        <span className="truncate">{label}</span>
      </span>
      <Badge tone={!hasGoal ? 'neutral' : reached ? 'positive' : 'warning'}>
        <span dir="ltr">{delta.deltaLabel}</span>
      </Badge>
    </div>
  );

  const progressBar = (
    <ProgressBar
      value={bar.baseFillPct + (bar.showOverflow ? bar.overflowPct : 0)}
      max={100}
      marker={bar.targetPct > 0 && bar.targetPct < 100 ? bar.targetPct : undefined}
      tone={reached ? 'positive' : 'accent'}
      size={variant === 'compact' ? 'sm' : 'md'}
    />
  );

  if (variant === 'compact') {
    return (
      <div className={`min-w-0 space-y-1 ${className}`}>
        {header}
        {progressBar}
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {header}
      {progressBar}
      <dl className="grid grid-cols-3 gap-2">
        {[
          ['فعلی', formatGoalValue(progress?.current ?? 0, kind, valueUnit)],
          ['هدف', formatGoalValue(progress?.target ?? 0, kind, valueUnit)],
          ['فاصله', goalGapLabel(progress, kind, valueUnit)],
        ].map(([k, v]) => (
          <div key={k}>
            <Text render={<dt />} variant="micro" tone="subtle">
              {k}
            </Text>
            <Text render={<dd />} variant="caption" weight="medium">
              <span dir="ltr">{v}</span>
            </Text>
          </div>
        ))}
      </dl>
    </div>
  );
}
