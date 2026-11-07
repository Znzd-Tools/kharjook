'use client';

import { Progress as BaseProgress } from '@base-ui/react/progress';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export type ProgressTone = 'accent' | 'positive' | 'negative' | 'warning' | 'auto';

const FILL: Record<Exclude<ProgressTone, 'auto'>, string> = {
  accent: 'bg-accent',
  positive: 'bg-positive',
  negative: 'bg-negative',
  warning: 'bg-warning',
};

/** auto: accent < 80%, warning 80–100%, negative > 100% (budget caps). */
function resolveTone(tone: ProgressTone, ratio: number): Exclude<ProgressTone, 'auto'> {
  if (tone !== 'auto') return tone;
  if (ratio > 1) return 'negative';
  if (ratio >= 0.8) return 'warning';
  return 'accent';
}

export interface ProgressBarProps {
  /** Current value. Can be above max (shows over-budget). */
  value: number;
  max?: number;
  tone?: ProgressTone;
  size?: 'sm' | 'md';
  label?: ReactNode;
  /** Text at the end of the label row, e.g. "۷۵٪". */
  valueLabel?: ReactNode;
  /** Optional marker (0..max), e.g. expected spend by today. */
  marker?: number;
  className?: string;
}

/** Linear progress for budgets, goals, loan payoff. */
export function ProgressBar({
  value,
  max = 100,
  tone = 'accent',
  size = 'sm',
  label,
  valueLabel,
  marker,
  className,
}: ProgressBarProps) {
  const ratio = max > 0 ? value / max : 0;
  const pct = Math.min(100, Math.max(0, ratio * 100));
  const t = resolveTone(tone, ratio);
  return (
    <BaseProgress.Root value={Math.min(value, max)} max={max} className={cn('flex flex-col gap-1.5', className)}>
      {(label || valueLabel) && (
        <div className="flex items-center justify-between gap-2 text-caption">
          {label && <BaseProgress.Label className="text-fg-muted">{label}</BaseProgress.Label>}
          {valueLabel && <span className="tabular text-fg-subtle">{valueLabel}</span>}
        </div>
      )}
      <BaseProgress.Track
        className={cn('relative w-full overflow-hidden rounded-full bg-hover', size === 'sm' ? 'h-1.5' : 'h-2.5')}
      >
        <BaseProgress.Indicator
          className={cn('block h-full rounded-full transition-[width] duration-(--ds-duration-slow) ease-standard', FILL[t])}
          style={{ width: `${pct}%` }}
        />
        {marker != null && max > 0 && (
          <span
            aria-hidden
            className="absolute inset-y-0 w-0.5 bg-fg/60"
            style={{ insetInlineStart: `${Math.min(100, (marker / max) * 100)}%` }}
          />
        )}
      </BaseProgress.Track>
    </BaseProgress.Root>
  );
}

export interface ProgressRingProps {
  value: number;
  max?: number;
  tone?: ProgressTone;
  size?: number;
  strokeWidth?: number;
  /** Content in the middle. */
  children?: ReactNode;
  'aria-label': string;
  className?: string;
}

/** Circular progress for goals and compact summaries. */
export function ProgressRing({
  value,
  max = 100,
  tone = 'accent',
  size = 56,
  strokeWidth = 5,
  children,
  className,
  ...props
}: ProgressRingProps) {
  const ratio = max > 0 ? value / max : 0;
  const t = resolveTone(tone, ratio);
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(1, Math.max(0, ratio)));
  const stroke = {
    accent: 'stroke-accent',
    positive: 'stroke-positive',
    negative: 'stroke-negative',
    warning: 'stroke-warning',
  }[t];
  return (
    <span
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={props['aria-label']}
      className={cn('relative inline-flex items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth} className="stroke-hover" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className={cn(stroke, 'transition-[stroke-dashoffset] duration-(--ds-duration-slow) ease-standard')}
        />
      </svg>
      {children && <span className="absolute inset-0 flex items-center justify-center text-micro tabular">{children}</span>}
    </span>
  );
}
