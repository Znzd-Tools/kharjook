'use client';

import { AlertCircle, PieChart } from 'lucide-react';

const PALETTE = ['#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899'];

export interface DistributionChartRow {
  name: string;
  value: number;
  label: string;
}

export function DistributionChartCard({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: DistributionChartRow[];
}) {
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  let cursor = 0;
  const donutStops =
    total > 0
      ? rows
          .map((row, index) => {
            const start = cursor;
            const size = (row.value / total) * 100;
            cursor += size;
            return `${PALETTE[index % PALETTE.length]} ${start}% ${cursor}%`;
          })
          .join(', ')
      : 'rgba(255,255,255,0.08) 0 100%';
  const topRow = rows[0] ?? null;

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/5 bg-[#1A1B26] p-4">
      <div className="absolute -left-14 bottom-8 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-slate-200">
            <PieChart size={16} className="text-cyan-300" />
            <p className="text-sm font-bold">{title}</p>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
        </div>
        {topRow && (
          <div className="rounded-2xl border border-white/5 bg-white/4 px-3 py-2 text-left">
            <p className="text-[10px] text-slate-500">بیشترین</p>
            <p className="max-w-24 truncate text-xs font-semibold text-white">{topRow.name}</p>
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <div className="relative flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/3 text-xs text-slate-500">
          <AlertCircle size={12} />
          <span className="mt-2">بدون داده</span>
        </div>
      ) : (
        <div className="relative grid grid-cols-[112px_1fr] items-center gap-4">
          <div className="relative h-28 w-28 shrink-0 rounded-full p-3">
            <div
              className="absolute inset-0 rounded-full shadow-2xl shadow-purple-950/30"
              style={{ background: `conic-gradient(${donutStops})` }}
            />
            <div className="absolute inset-4 rounded-full bg-[#1A1B26] ring-1 ring-white/10" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] text-slate-500">کل</span>
              <span className="text-lg font-black text-white">
                {rows.length.toLocaleString('fa-IR')}
              </span>
            </div>
          </div>
          <div className="min-w-0 space-y-3">
            {rows.map((row, index) => {
              const percent = total > 0 ? (row.value / total) * 100 : 0;
              return (
                <div key={row.name} className="group">
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_14px_rgba(255,255,255,0.16)]"
                        style={{ backgroundColor: PALETTE[index % PALETTE.length] }}
                      />
                      <span className="truncate text-sm text-slate-300 group-hover:text-white">
                        {row.name}
                      </span>
                    </div>
                    <div className="shrink-0 text-left">
                      <div className="text-[11px] text-slate-300" dir="ltr">
                        {row.label}
                      </div>
                      <div className="text-[10px] text-slate-500" dir="ltr">
                        {percent.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full transition-all duration-500 group-hover:brightness-125"
                      style={{
                        width: `${percent}%`,
                        background: `linear-gradient(90deg, ${PALETTE[index % PALETTE.length]}, rgba(255,255,255,0.7))`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
