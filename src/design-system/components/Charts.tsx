'use client';

import { cloneElement, useId, useMemo, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { useAmountPending } from './AmountPending';
import { squarify } from '../lib/squarify';

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
function SparklineInner({ data, width = 96, height = 28, tone = 'auto', area = true, className, ...props }: SparklineProps) {
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
function AllocationBarInner({ segments, maxSegments = 5, legend = true, formatValue, className }: AllocationBarProps) {
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
function BarChartInner({ data, height = 120, activeKey, formatValue = String, mode = 'magnitude', className, ...props }: BarChartProps) {
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

/* ------------------------------------------------------------------ */
/* AreaChart — one value over time, with a touch crosshair.            */
/* ------------------------------------------------------------------ */

export interface AreaPoint {
  key: string;
  /** Short label for the tooltip (e.g. a date). */
  label: string;
  value: number;
}

export interface AreaChartProps {
  data: AreaPoint[];
  height?: number;
  /** `on-hero`: draws in the hero text color (for the hero card). */
  tone?: 'accent' | 'positive' | 'negative' | 'on-hero';
  /** Value in the tooltip. */
  formatValue?: (value: number) => ReactNode;
  /** Called with the point under the finger (null when it leaves). */
  onActiveChange?: (point: AreaPoint | null) => void;
  'aria-label': string;
  className?: string;
}

const AREA_COLOR = { ...STROKE, 'on-hero': 'var(--color-fg-on-hero)' } as const;

/**
 * Line + soft area, no axes (the hero number is the scale). Time runs left
 * to right. Drag or hover to read any point: a vertical line, a dot and the
 * value. Tooltip text uses text tokens, never the line color.
 */
function AreaChartInner({ data, height = 96, tone = 'accent', formatValue = String, onActiveChange, className, ...props }: AreaChartProps) {
  const gid = useId();
  const [active, setActive] = useState<number | null>(null);
  const W = 300;
  const geo = useMemo(() => {
    if (data.length < 2) return null;
    const vals = data.map((d) => d.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = max - min || Math.abs(max) || 1;
    const top = 6;
    const bottom = height - 4;
    const x = (i: number) => (i / (data.length - 1)) * W;
    const y = (v: number) => bottom - ((v - min) / span) * (bottom - top);
    const pts = data.map((d, i) => [x(i), y(d.value)] as const);
    const line = pts.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
    return { pts, line, area: `${line} L${W},${height} L0,${height} Z` };
  }, [data, height]);
  const color = AREA_COLOR[tone];

  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const i = Math.round(t * (data.length - 1));
    setActive(i);
    onActiveChange?.(data[i] ?? null);
  };
  const leave = () => {
    setActive(null);
    onActiveChange?.(null);
  };

  if (!geo) return <div className={cn('w-full', className)} style={{ height }} />;
  const a = active != null ? geo.pts[active] : null;
  const point = active != null ? data[active] : null;

  return (
    <figure className={cn('relative w-full select-none', className)} style={{ height }}>
      <svg
        role="img"
        aria-label={props['aria-label']}
        viewBox={`0 0 ${W} ${height}`}
        preserveAspectRatio="none"
        className="h-full w-full touch-pan-y overflow-visible"
        style={{ direction: 'ltr' }}
        onPointerMove={(e) => pick(e.clientX, e.currentTarget)}
        onPointerDown={(e) => pick(e.clientX, e.currentTarget)}
        onPointerLeave={leave}
        onPointerUp={(e) => e.pointerType !== 'mouse' && leave()}
      >
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.28} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={geo.area} fill={`url(#${gid})`} />
        <path d={geo.line} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        {a && <line x1={a[0]} x2={a[0]} y1={0} y2={height} stroke={color} strokeOpacity={0.4} strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      </svg>
      {a && point && (
        <>
          <span
            aria-hidden
            className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-panel"
            style={{ left: `${(a[0] / W) * 100}%`, top: a[1], backgroundColor: color }}
          />
          <span
            className="pointer-events-none absolute -top-7 -translate-x-1/2 whitespace-nowrap rounded-control bg-panel px-2 py-0.5 text-micro text-fg shadow-md"
            style={{ left: `${Math.min(85, Math.max(15, (a[0] / W) * 100))}%` }}
          >
            <span className="text-fg-subtle">{point.label}</span> <span className="font-semibold tabular">{formatValue(point.value)}</span>
          </span>
        </>
      )}
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* DonutChart — parts of a whole, with a center label.                 */
/* ------------------------------------------------------------------ */

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  /** Entity color (e.g. the category color). Default: chart-1..8 by order. */
  color?: string;
  /** Extra text in the legend row (e.g. "هدف ۳۰٪"). */
  note?: ReactNode;
}

export interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  /** Max segments before folding the rest into "سایر". Default 6. */
  maxSegments?: number;
  /** Center content when nothing is selected. */
  center?: ReactNode;
  /** Center/legend value for a segment. */
  formatValue?: (value: number, share: number) => ReactNode;
  legend?: boolean;
  'aria-label': string;
  className?: string;
}

const toFa = (n: number) => n.toFixed(0).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!);

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)] as const;
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
}

/**
 * Donut with a gap between segments. Tap a segment or a legend row to see
 * its value in the center; tap again to clear. Color follows the entity.
 */
function DonutChartInner({ segments, size = 168, thickness = 22, maxSegments = 6, center, formatValue, legend = true, className, ...props }: DonutChartProps) {
  const [sel, setSel] = useState<string | null>(null);
  const items = useMemo(() => {
    // Two segments may not share a color (e.g. two categories saved with the
    // same color): the later one takes the next free palette color.
    const used = new Set<string>();
    const colored = segments
      .filter((s) => s.value > 0)
      .map((s, i) => {
        let color = s.color ?? CHART_VARS[i] ?? 'var(--color-chart-other)';
        if (used.has(color.toLowerCase())) color = CHART_VARS.find((c) => !used.has(c)) ?? 'var(--color-chart-other)';
        used.add(color.toLowerCase());
        return { ...s, color };
      });
    if (colored.length <= maxSegments) return colored;
    const sorted = [...colored].sort((a, b) => b.value - a.value);
    const keep = new Set(sorted.slice(0, maxSegments - 1).map((s) => s.key));
    const rest = colored.filter((s) => !keep.has(s.key)).reduce((a, s) => a + s.value, 0);
    return [...colored.filter((s) => keep.has(s.key)), { key: '__other', label: 'سایر', value: rest, color: 'var(--color-chart-other)', note: undefined }];
  }, [segments, maxSegments]);
  const total = items.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = size / 2;
  const gap = items.length > 1 ? 0.035 : 0;
  const arcs = useMemo(() => {
    const ends = items.reduce<number[]>((list, s) => [...list, (list.at(-1) ?? 0) + s.value], []);
    return items.map((s, i) => {
      const a0 = ((ends[i - 1] ?? 0) / total) * Math.PI * 2;
      const a1 = (ends[i]! / total) * Math.PI * 2;
      return { ...s, d: items.length === 1 ? null : arcPath(c, c, r, a0 + gap / 2, Math.max(a0 + gap / 2 + 0.001, a1 - gap / 2)) };
    });
  }, [items, total, c, r, gap]);
  const active = items.find((s) => s.key === sel) ?? null;
  const share = (v: number) => v / total;
  const fmt = (v: number) => (formatValue ? formatValue(v, share(v)) : `${toFa(share(v) * 100)}٪`);
  const toggle = (k: string) => setSel((x) => (x === k ? null : k));

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg role="img" aria-label={props['aria-label']} width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {arcs.map((s) =>
            s.d ? (
              <path
                key={s.key}
                d={s.d}
                fill="none"
                stroke={s.color}
                strokeWidth={sel === s.key ? thickness + 4 : thickness}
                strokeOpacity={sel && sel !== s.key ? 0.3 : 1}
                className="cursor-pointer transition-[stroke-opacity,stroke-width] duration-(--ds-duration-base)"
                onClick={() => toggle(s.key)}
              >
                <title>{`${s.label}: ${toFa(share(s.value) * 100)}٪`}</title>
              </path>
            ) : (
              <circle key={s.key} cx={c} cy={c} r={r} fill="none" stroke={s.color} strokeWidth={thickness} />
            )
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          {active ? (
            <>
              <span className="max-w-full truncate text-caption text-fg-muted">{active.label}</span>
              <span className="text-title font-bold text-fg tabular">{toFa(share(active.value) * 100)}٪</span>
              {formatValue && <span className="text-micro text-fg-subtle">{formatValue(active.value, share(active.value))}</span>}
            </>
          ) : (
            center
          )}
        </div>
      </div>
      {legend && (
        <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-1">
          {items.map((s) => (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => toggle(s.key)}
                aria-pressed={sel === s.key}
                className={cn(
                  'ds-focus flex w-full min-w-0 items-center gap-2 rounded-control px-1 py-1 text-start text-caption transition-opacity',
                  sel && sel !== s.key && 'opacity-40'
                )}
              >
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="min-w-0 flex-1 truncate text-fg-muted">{s.label}</span>
                <span className="shrink-0 text-end">
                  <span className="block text-fg tabular">{toFa(share(s.value) * 100)}٪</span>
                  {s.note && <span className="block text-micro text-fg-subtle">{s.note}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {!legend && active && <span className="text-caption text-fg-muted">{fmt(active.value)}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DivergingBars — gains right, losses left, one row per item.         */
/* ------------------------------------------------------------------ */

export interface DivergingRow {
  key: string;
  label: ReactNode;
  value: number;
  /** Text at the end of the row (e.g. the formatted amount). */
  valueLabel?: ReactNode;
  /** Row becomes a link/button. */
  render?: React.ReactElement;
  leading?: ReactNode;
}

export interface DivergingBarsProps {
  rows: DivergingRow[];
  'aria-label': string;
  className?: string;
}

/**
 * Ranked gains and losses on one zero line. Green grows right, red grows
 * left (physical, like a number line), so size and sign read at a glance.
 */
function DivergingBarsInner({ rows, className, ...props }: DivergingBarsProps) {
  const maxAbs = Math.max(1e-9, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul aria-label={props['aria-label']} className={cn('divide-y divide-line overflow-hidden rounded-card bg-panel', className)}>
      {rows.map((r) => {
        const w = (Math.abs(r.value) / maxAbs) * 50;
        const pos = r.value >= 0;
        const body = (
          <>
            <span className="flex min-w-0 items-center gap-2">
              {r.leading}
              <span className="min-w-0 flex-1 truncate text-callout text-fg">{r.label}</span>
              <span className="shrink-0 text-caption">{r.valueLabel}</span>
            </span>
            <span aria-hidden className="relative block h-2 w-full" style={{ direction: 'ltr' }}>
              <span className="absolute inset-y-[-3px] left-1/2 w-px bg-line" />
              <span
                className={cn('absolute inset-y-0', pos ? 'left-1/2 rounded-e-[4px] bg-positive' : 'right-1/2 rounded-s-[4px] bg-negative')}
                style={{ width: `${Math.max(w, 0.8)}%` }}
              />
            </span>
          </>
        );
        return (
          <li key={r.key}>
            {r.render ? (
              <ListLink render={r.render}>{body}</ListLink>
            ) : (
              <div className="flex flex-col gap-2 px-4 py-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ListLink({ render, children }: { render: React.ReactElement; children: ReactNode }) {
  const props = render.props as { className?: string };
  return cloneElement(render, { className: cn('ds-focus flex flex-col gap-2 px-4 py-3 hover:bg-hover', props.className) } as never, children);
}

/* ------------------------------------------------------------------ */
/* CalendarHeatmap — one cell per day, darker = more.                  */
/* ------------------------------------------------------------------ */

export interface HeatDay {
  /** Jalali "YYYY/MM/DD". */
  key: string;
  /** Day of month shown in the cell. */
  day: number;
  /** 0 = شنبه … 6 = جمعه. */
  weekday: number;
  value: number;
  /** Full date text for the caption. */
  label: string;
}

export interface CalendarHeatmapProps {
  days: HeatDay[];
  tone?: 'negative' | 'positive' | 'accent';
  formatValue?: (value: number) => ReactNode;
  'aria-label': string;
  className?: string;
}

const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];
const HEAT_ALPHA = [0, 0.22, 0.42, 0.66, 1];

/**
 * Month calendar (week rows, Saturday first, RTL). One hue, light to dark by
 * quartile of the non-zero days. Tap a day to read its value; the caption
 * shows the biggest day until then.
 */
function CalendarHeatmapInner({ days, tone = 'negative', formatValue = String, className, ...props }: CalendarHeatmapProps) {
  const [sel, setSel] = useState<string | null>(null);
  const levels = useMemo(() => {
    const vals = days.map((d) => d.value).filter((v) => v > 0).sort((a, b) => a - b);
    const q = (p: number) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] ?? 0;
    const cuts = [q(0.25), q(0.5), q(0.75)];
    return new Map(days.map((d) => [d.key, d.value <= 0 ? 0 : d.value <= cuts[0]! ? 1 : d.value <= cuts[1]! ? 2 : d.value <= cuts[2]! ? 3 : 4]));
  }, [days]);
  const color = STROKE[tone];
  const biggest = days.reduce<HeatDay | null>((m, d) => (d.value > (m?.value ?? 0) ? d : m), null);
  const shown = days.find((d) => d.key === sel) ?? null;
  const lead = days[0]?.weekday ?? 0;

  return (
    <figure className={cn('flex flex-col gap-2', className)}>
      <figcaption className="flex h-5 items-baseline justify-between gap-2 text-caption">
        <span className="truncate text-fg-subtle">{shown ? shown.label : biggest ? `بیشترین: ${biggest.label}` : 'روزی ثبت نشده'}</span>
        <span className="shrink-0 font-semibold text-fg tabular">{shown ? formatValue(shown.value) : biggest ? formatValue(biggest.value) : null}</span>
      </figcaption>
      <div role="group" aria-label={props['aria-label']} className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((w) => (
          <span key={w} aria-hidden className="text-center text-micro text-fg-subtle">
            {w}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} aria-hidden />
        ))}
        {days.map((d) => {
          const lv = levels.get(d.key) ?? 0;
          const on = sel === d.key;
          return (
            <button
              key={d.key}
              type="button"
              aria-label={`${d.label}: ${d.value > 0 ? d.value : 'بدون'}`}
              aria-pressed={on}
              onClick={() => setSel(on ? null : d.key)}
              className={cn(
                'ds-focus relative aspect-square rounded-md text-micro tabular transition-shadow',
                lv === 0 && 'bg-sunken text-fg-subtle',
                lv >= 3 ? 'text-fg-on-accent' : lv > 0 && 'text-fg',
                on && 'ring-2 ring-fg'
              )}
              style={lv > 0 ? { backgroundColor: `color-mix(in oklab, ${color} ${HEAT_ALPHA[lv]! * 100}%, transparent)` } : undefined}
            >
              {d.day.toLocaleString('fa-IR')}
            </button>
          );
        })}
      </div>
      <div aria-hidden className="flex items-center justify-end gap-1 text-micro text-fg-subtle">
        کم
        {HEAT_ALPHA.slice(1).map((a) => (
          <span key={a} className="size-2.5 rounded-sm" style={{ backgroundColor: `color-mix(in oklab, ${color} ${a * 100}%, transparent)` }} />
        ))}
        زیاد
      </div>
    </figure>
  );
}

/* ------------------------------------------------------------------ */
/* Treemap — size = value, color = change (diverging, gray midpoint).  */
/* ------------------------------------------------------------------ */

export interface TreemapItem {
  key: string;
  label: string;
  value: number;
  /** Change in percent for the color; null = no data (gray). */
  change: number | null;
  /** Makes the cell a link/button. */
  render?: React.ReactElement;
}

export interface TreemapProps {
  items: TreemapItem[];
  height?: number;
  /** |change| at which the color is full. Default 20 (%). */
  fullAt?: number;
  /** Share text shown in big cells. */
  formatShare?: (share: number) => ReactNode;
  'aria-label': string;
  className?: string;
}

const pctFa = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪`;

/**
 * Squarified treemap. Diverging color: green up, red down, gray at zero or
 * without data; the strength follows |change| up to `fullAt`. Labels only
 * where they fit; every cell has an accessible name.
 */
function TreemapInner({ items, height = 280, fullAt = 20, className, ...props }: TreemapProps) {
  const rects = useMemo(() => squarify(items), [items]);
  const byKey = useMemo(() => new Map(items.map((i) => [i.key, i])), [items]);
  const total = items.reduce((a, i) => a + Math.max(0, i.value), 0) || 1;
  return (
    <div role="group" aria-label={props['aria-label']} className={cn('relative w-full overflow-hidden rounded-card bg-panel', className)} style={{ height }}>
      {rects.map((r) => {
        const it = byKey.get(r.key)!;
        const c = it.change;
        const strength = c == null || c === 0 ? 0 : Math.min(1, Math.abs(c) / fullAt);
        const hue = c != null && c > 0 ? 'var(--color-positive)' : 'var(--color-negative)';
        const bg = strength === 0 ? 'var(--color-sunken)' : `color-mix(in oklab, ${hue} ${Math.round(25 + strength * 60)}%, var(--color-sunken))`;
        const big = r.w > 22 && r.h > 16;
        const fits = r.w > 13 && r.h > 9;
        const share = it.value / total;
        const name = `${it.label}، ${toFa(share * 100)}٪ سبد${c != null ? `، ${pctFa(c)} در ۳۰ روز` : ''}`;
        const body = fits ? (
          <span className="flex h-full min-w-0 flex-col justify-between p-2 text-start">
            <span className="truncate text-caption font-semibold text-fg">{it.label}</span>
            <span className="flex flex-wrap items-baseline justify-between gap-x-1 text-micro">
              {big && <span className="text-fg-muted tabular">{toFa(share * 100)}٪</span>}
              {c != null && <span className="font-semibold text-fg tabular" dir="ltr">{pctFa(c)}</span>}
            </span>
          </span>
        ) : null;
        const style = { left: `${r.x}%`, top: `${r.y}%`, width: `${r.w}%`, height: `${r.h}%` };
        const cls = 'ds-focus absolute block overflow-hidden border-2 border-panel transition-[filter] hover:brightness-110';
        return it.render ? (
          cloneElement(it.render, { key: r.key, 'aria-label': name, className: cls, style: { ...style, backgroundColor: bg } } as never, body)
        ) : (
          <span key={r.key} role="img" aria-label={name} className={cls} style={{ ...style, backgroundColor: bg }}>
            {body}
          </span>
        );
      })}
    </div>
  );
}

/* While the numbers are not final (see AmountPendingProvider), charts show a
   shimmer block of their own size instead of a shape that changes later. */

export function Sparkline(props: SparklineProps) {
  const pending = useAmountPending();
  if (pending) {
    return (
      <span
        aria-hidden
        className={cn('inline-block animate-ds-shimmer rounded-control bg-hover', props.className)}
        style={{ width: props.width ?? 96, height: props.height ?? 28 }}
      />
    );
  }
  return <SparklineInner {...props} />;
}

export function AllocationBar(props: AllocationBarProps) {
  const pending = useAmountPending();
  if (pending) return <span aria-hidden className={cn('block h-3 w-full animate-ds-shimmer rounded-full bg-hover', props.className)} />;
  return <AllocationBarInner {...props} />;
}

export function BarChart(props: BarChartProps) {
  const pending = useAmountPending();
  if (pending) {
    return <span aria-hidden className={cn('block w-full animate-ds-shimmer rounded-card bg-hover', props.className)} style={{ height: props.height ?? 120 }} />;
  }
  return <BarChartInner {...props} />;
}

export function AreaChart(props: AreaChartProps) {
  const pending = useAmountPending();
  if (pending) {
    return <span aria-hidden className={cn('block w-full animate-ds-shimmer rounded-card bg-hover', props.className)} style={{ height: props.height ?? 96 }} />;
  }
  return <AreaChartInner {...props} />;
}

export function DonutChart(props: DonutChartProps) {
  const pending = useAmountPending();
  if (pending) {
    const size = props.size ?? 168;
    return <span aria-hidden className={cn('mx-auto block animate-ds-shimmer rounded-full bg-hover', props.className)} style={{ width: size, height: size }} />;
  }
  return <DonutChartInner {...props} />;
}

export function DivergingBars(props: DivergingBarsProps) {
  const pending = useAmountPending();
  if (pending) return <span aria-hidden className={cn('block h-48 w-full animate-ds-shimmer rounded-card bg-hover', props.className)} />;
  return <DivergingBarsInner {...props} />;
}

export function CalendarHeatmap(props: CalendarHeatmapProps) {
  const pending = useAmountPending();
  if (pending) return <span aria-hidden className={cn('block h-56 w-full animate-ds-shimmer rounded-card bg-hover', props.className)} />;
  return <CalendarHeatmapInner {...props} />;
}

export function Treemap(props: TreemapProps) {
  const pending = useAmountPending();
  if (pending) return <span aria-hidden className={cn('block w-full animate-ds-shimmer rounded-card bg-hover', props.className)} style={{ height: props.height ?? 280 }} />;
  return <TreemapInner {...props} />;
}
