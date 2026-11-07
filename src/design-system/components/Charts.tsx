'use client';

import { useId, useMemo, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';

/* ------------------------------------------------------------------ */
/* Sparkline — trend at a glance, no axes.                             */
/* ------------------------------------------------------------------ */

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  /** `auto`: green if last ≥ first, else red. */
  tone?: 'auto' | 'accent' | 'positive' | 'negative' | 'muted';
  /** Soft area fill under the line. Default true. */
  area?: boolean;
  'aria-label': string;
  className?: string;
}

const STROKE = {
  accent: 'var(--color-accent)',
  positive: 'var(--color-positive)',
  negative: 'var(--color-negative)',
  muted: 'var(--color-fg-subtle)',
} as const;

/** Tiny line chart for stat tiles and asset rows. */
export function Sparkline({ data, width = 96, height = 28, tone = 'auto', area = true, className, ...props }: SparklineProps) {
  const gid = useId();
  const path = useMemo(() => {
    if (data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const step = width / (data.length - 1);
    const pts = data.map((v, i) => [i * step, height - 2 - ((v - min) / span) * (height - 4)] as const);
    const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    return { line, area: `${line} L${width},${height} L0,${height} Z` };
  }, [data, width, height]);
  const t = tone === 'auto' ? ((data.at(-1) ?? 0) >= (data[0] ?? 0) ? 'positive' : 'negative') : tone;
  const color = STROKE[t];
  return (
    <svg role="img" aria-label={props['aria-label']} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn('overflow-visible', className)} style={{ direction: 'ltr' }}>
      {path && (
        <>
          {area && (
            <>
              <defs>
                <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <path d={path.area} fill={`url(#${gid})`} />
            </>
          )}
          <path d={path.line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* AllocationBar — parts of a whole (portfolio split).                 */
/* ------------------------------------------------------------------ */

export interface AllocationSegment {
  key: string;
  label: string;
  value: number;
  /** Override color. Default: chart-1..8 in order, then "other". */
  color?: string;
}

export interface AllocationBarProps {
  segments: AllocationSegment[];
  /** Max segments before folding the rest into "سایر". Default 5. */
  maxSegments?: number;
  /** Show legend under the bar. Default true. */
  legend?: boolean;
  /** Format the legend value (e.g. percent or Amount). */
  formatValue?: (value: number, share: number) => ReactNode;
  className?: string;
}

const CHART_VARS = Array.from({ length: 8 }, (_, i) => `var(--color-chart-${i + 1})`);

/** Stacked 100% bar with legend. Color follows the entity order, never rank. */
export function AllocationBar({ segments, maxSegments = 5, legend = true, formatValue, className }: AllocationBarProps) {
  const [hover, setHover] = useState<string | null>(null);
  const items = useMemo(() => {
    const colored = segments.map((s, i) => ({ ...s, color: s.color ?? CHART_VARS[i] ?? 'var(--color-chart-other)' }));
    if (colored.length <= maxSegments) return colored;
    const head = colored.slice(0, maxSegments - 1);
    const rest = colored.slice(maxSegments - 1).reduce((a, s) => a + s.value, 0);
    return [...head, { key: '__other', label: 'سایر', value: rest, color: 'var(--color-chart-other)' }];
  }, [segments, maxSegments]);
  const total = items.reduce((a, s) => a + Math.max(0, s.value), 0) || 1;
  const pct = (v: number) => `${((v / total) * 100).toFixed(1)}%`;

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div role="img" aria-label={items.map((s) => `${s.label} ${pct(s.value)}`).join('، ')} className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full">
        {items.map((s) => (
          <span
            key={s.key}
            onPointerEnter={() => setHover(s.key)}
            onPointerLeave={() => setHover(null)}
            title={`${s.label}: ${pct(s.value)}`}
            className={cn('h-full transition-opacity first:rounded-s-full last:rounded-e-full', hover && hover !== s.key && 'opacity-40')}
            style={{ width: pct(s.value), backgroundColor: s.color }}
          />
        ))}
      </div>
      {legend && (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
          {items.map((s) => (
            <li
              key={s.key}
              onPointerEnter={() => setHover(s.key)}
              onPointerLeave={() => setHover(null)}
              className={cn('flex min-w-0 items-center gap-2 text-caption transition-opacity', hover && hover !== s.key && 'opacity-40')}
            >
              <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="min-w-0 flex-1 truncate text-fg-muted">{s.label}</span>
              <span className="shrink-0 text-fg tabular">
                {formatValue ? formatValue(s.value, s.value / total) : `${((s.value / total) * 100).toFixed(0).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!)}٪`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* BarChart — small vertical bars (monthly cashflow).                  */
/* ------------------------------------------------------------------ */

export interface BarDatum {
  key: string;
  label: string;
  value: number;
}

export interface BarChartProps {
  data: BarDatum[];
  height?: number;
  /** Key of the highlighted bar (e.g. current month). */
  activeKey?: string;
  /** Format the hover/active value label. */
  formatValue?: (value: number) => ReactNode;
  /** `signed`: positive up in green, negative down in red (net cashflow). */
  mode?: 'magnitude' | 'signed';
  'aria-label': string;
  className?: string;
}

/** Compact bar chart with hover value. One axis, no gridlines. */
export function BarChart({ data, height = 120, activeKey, formatValue = String, mode = 'magnitude', className, ...props }: BarChartProps) {
  const [hover, setHover] = useState<string | null>(null);
  const shown = hover ?? activeKey ?? data.at(-1)?.key;
  const current = data.find((d) => d.key === shown);
  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  const signed = mode === 'signed' && data.some((d) => d.value < 0);

  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      <figcaption className="flex h-5 items-baseline justify-between text-caption">
        <span className="text-fg-subtle">{current?.label}</span>
        <span className="font-semibold text-fg tabular">{current ? formatValue(current.value) : null}</span>
      </figcaption>
      <div role="img" aria-label={props['aria-label']} className="relative flex items-stretch gap-1.5" style={{ height }}>
        {signed && <span aria-hidden className="absolute inset-x-0 top-1/2 h-px bg-line" />}
        {data.map((d) => {
          const h = (Math.abs(d.value) / maxAbs) * (signed ? 50 : 100);
          const neg = d.value < 0;
          const active = d.key === shown;
          const color = mode === 'signed' ? (neg ? 'bg-negative' : 'bg-positive') : 'bg-accent';
          return (
            <button
              key={d.key}
              type="button"
              aria-label={`${d.label}: ${d.value}`}
              onPointerEnter={() => setHover(d.key)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(d.key)}
              onBlur={() => setHover(null)}
              className="ds-focus relative flex-1 rounded-md"
            >
              <span
                className={cn(
                  'absolute inset-x-0 mx-auto w-full max-w-6 transition-[opacity,height] duration-(--ds-duration-base)',
                  color,
                  active ? 'opacity-100' : 'opacity-45',
                  signed ? (neg ? 'top-1/2 rounded-b-[4px]' : 'bottom-1/2 rounded-t-[4px]') : 'bottom-0 rounded-t-[4px]'
                )}
                style={{ height: `${Math.max(h, 2)}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="flex gap-1.5" aria-hidden>
        {data.map((d) => (
          <span key={d.key} className={cn('flex-1 truncate text-center text-micro', d.key === shown ? 'text-fg' : 'text-fg-subtle')}>
            {d.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
