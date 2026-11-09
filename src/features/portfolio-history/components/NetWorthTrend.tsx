'use client';

/**
 * Net worth over time (stored snapshots), in Toman or in dollars. The dollar
 * line answers "did I really get richer?" when the Toman line only shows
 * inflation.
 */
import { useEffect, useMemo, useState } from 'react';
import { Amount, Delta, SegmentedControl, Section, Skeleton, Text } from '@/design-system';
import { supabase } from '@/shared/lib/supabase/client';
import { JALALI_MONTHS } from '@/shared/utils/jalali';

export interface SnapshotPoint {
  date_string: string;
  total_toman: number;
  total_usd: number;
  assets_toman: number;
  cash_toman: number;
  usd_rate: number | null;
  by_asset: Record<string, { qty: number; toman: number; usd: number }>;
  by_group: Record<string, number>;
  source: 'daily' | 'backfill';
}

/** Snapshots, oldest first. Saves today's (and backfills) once if missing. */
export function useSnapshots() {
  const [rows, setRows] = useState<SnapshotPoint[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const { data } = await supabase
        .from('portfolio_snapshots')
        .select('date_string, total_toman, total_usd, assets_toman, cash_toman, usd_rate, by_asset, by_group, source')
        .order('date_string', { ascending: true });
      return (data ?? []) as SnapshotPoint[];
    };
    void (async () => {
      let r = await load();
      if (r.length < 2) {
        const res = await fetch('/api/portfolio/snapshots', { method: 'POST' }).catch(() => null);
        if (res?.ok) r = await load();
      }
      if (alive) setRows(r);
    })();
    return () => {
      alive = false;
    };
  }, []);
  return rows;
}

const monthLabel = (d: string) => {
  const [, m] = d.split('/').map(Number) as [number, number];
  return JALALI_MONTHS[m - 1]!.slice(0, 3);
};

export function NetWorthTrend({ rows }: { rows: SnapshotPoint[] | null }) {
  const [unit, setUnit] = useState<'TOMAN' | 'USD'>('USD');
  // One point per month (last row of each month) keeps the line readable.
  const points = useMemo(() => {
    if (!rows) return [];
    const byMonth = new Map<string, SnapshotPoint>();
    for (const r of rows) byMonth.set(r.date_string.slice(0, 7), r);
    return [...byMonth.values()].slice(-13);
  }, [rows]);

  if (rows === null) return <Skeleton className="h-48 rounded-card" />;
  if (points.length < 2)
    return (
      <Section title="روند ارزش سبد">
        <Text variant="caption" tone="subtle" className="block rounded-card bg-panel p-4">
          از امروز ارزش سبد هر روز ذخیره می‌شود. نمودار بعد از چند روز کامل می‌شود.
        </Text>
      </Section>
    );

  const val = (p: SnapshotPoint) => (unit === 'USD' ? Number(p.total_usd) : Number(p.total_toman));
  const vals = points.map(val);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const W = 320;
  const H = 120;
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - 8 - ((v - min) / span) * (H - 24);
  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const first = vals[0]!;
  const last = vals[vals.length - 1]!;
  const change = first > 0 ? ((last - first) / first) * 100 : null;
  const tUsd = points.map((p) => Number(p.total_usd));
  const tTom = points.map((p) => Number(p.total_toman));
  const usdChange = tUsd[0]! > 0 ? ((tUsd.at(-1)! - tUsd[0]!) / tUsd[0]!) * 100 : null;
  const tomChange = tTom[0]! > 0 ? ((tTom.at(-1)! - tTom[0]!) / tTom[0]!) * 100 : null;

  return (
    <Section
      title="روند ارزش سبد"
      action={
        <SegmentedControl
          aria-label="واحد نمودار"
          size="sm"
          fullWidth={false}
          value={unit}
          onValueChange={(v) => setUnit(v as 'TOMAN' | 'USD')}
          options={[
            { value: 'USD', label: 'دلار' },
            { value: 'TOMAN', label: 'تومان' },
          ]}
        />
      }
    >
      <div className="space-y-3 rounded-card bg-panel p-4">
        <div className="flex items-end justify-between gap-2">
          <div>
            <Text variant="caption" tone="subtle">
              از {monthLabel(points[0]!.date_string)} تا امروز
            </Text>
            <Amount value={last} currency={unit} size="lg" compact />
          </div>
          {change !== null && <Delta value={change} />}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-32 w-full" role="img" aria-label={`روند ارزش سبد به ${unit === 'USD' ? 'دلار' : 'تومان'}`} preserveAspectRatio="none">
          <path d={`${line} L${W},${H} L0,${H} Z`} className="fill-accent/15" />
          <path d={line} className="fill-none stroke-accent" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="flex justify-between text-micro text-fg-subtle" aria-hidden>
          {points.map((p, i) => (i % Math.ceil(points.length / 6) === 0 || i === points.length - 1 ? <span key={p.date_string}>{monthLabel(p.date_string)}</span> : null))}
        </div>
        {usdChange !== null && tomChange !== null && (
          <p className="rounded-control bg-sunken p-3 text-caption text-fg-muted">
            به تومان {tomChange >= 0 ? 'رشد' : 'افت'} {Math.abs(tomChange).toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪، به دلار{' '}
            <span className={usdChange >= 0 ? 'text-positive-ink font-semibold' : 'text-negative-ink font-semibold'}>
              {usdChange >= 0 ? 'رشد' : 'افت'} {Math.abs(usdChange).toLocaleString('fa-IR', { maximumFractionDigits: 1 })}٪
            </span>
            . {usdChange < tomChange ? 'بخشی از رشد تومانی فقط تورم است.' : ''}
          </p>
        )}
      </div>
    </Section>
  );
}
