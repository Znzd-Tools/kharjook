'use client';

import { ChevronLeft, ChevronRight } from '../icons';
import { useMemo, useState } from 'react';
import {
  JALALI_MONTHS,
  equalsJalaali,
  jalaaliMonthLength,
  jalaaliWeekday,
  todayJalaali,
  type JalaaliDate,
} from '@/shared/utils/jalali';
import { cn } from '../lib/cn';
import { toPersianDigits } from '../lib/format';
import { IconButton } from './IconButton';

const WEEKDAYS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

export interface CalendarProps {
  value: JalaaliDate | null;
  onValueChange: (value: JalaaliDate) => void;
  /** Dots under days with events (e.g. due checks). Keys: "YYYY/M/D". */
  marks?: Record<string, 'accent' | 'warning' | 'negative' | 'positive'>;
  className?: string;
}

const key = (d: JalaaliDate) => `${d.jy}/${d.jm}/${d.jd}`;
const DOT = { accent: 'bg-accent', warning: 'bg-warning', negative: 'bg-negative', positive: 'bg-positive' } as const;

/** Jalali month grid. Week starts on شنبه. */
export function Calendar({ value, onValueChange, marks, className }: CalendarProps) {
  const today = useMemo(() => todayJalaali(), []);
  const [view, setView] = useState(() => ({ jy: (value ?? today).jy, jm: (value ?? today).jm }));

  const len = jalaaliMonthLength(view.jy, view.jm);
  const offset = jalaaliWeekday({ jy: view.jy, jm: view.jm, jd: 1 });
  const cells: (number | null)[] = [...Array(offset).fill(null), ...Array.from({ length: len }, (_, i) => i + 1)];

  const shift = (delta: number) =>
    setView((v) => {
      const m = v.jm + delta;
      if (m < 1) return { jy: v.jy - 1, jm: 12 };
      if (m > 12) return { jy: v.jy + 1, jm: 1 };
      return { jy: v.jy, jm: m };
    });

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <IconButton aria-label="ماه قبل" icon={<ChevronRight />} size="sm" onClick={() => shift(-1)} />
        <span className="text-callout font-semibold text-fg" aria-live="polite">
          {JALALI_MONTHS[view.jm - 1]} {toPersianDigits(view.jy)}
        </span>
        <IconButton aria-label="ماه بعد" icon={<ChevronLeft />} size="sm" onClick={() => shift(1)} />
      </div>
      <div role="grid" className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} role="columnheader" className="py-1 text-micro text-fg-subtle">
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (d == null) return <span key={`e${i}`} />;
          const date = { jy: view.jy, jm: view.jm, jd: d };
          const selected = value ? equalsJalaali(value, date) : false;
          const isToday = equalsJalaali(today, date);
          const mark = marks?.[key(date)];
          return (
            <button
              key={d}
              type="button"
              role="gridcell"
              aria-selected={selected}
              aria-current={isToday ? 'date' : undefined}
              onClick={() => onValueChange(date)}
              className={cn(
                'ds-focus relative mx-auto flex size-10 items-center justify-center rounded-full text-callout tabular transition-colors',
                selected ? 'bg-accent font-semibold text-fg-on-accent' : 'text-fg hover:bg-hover',
                !selected && isToday && 'font-semibold text-accent-ink ring-1 ring-accent/50 ring-inset'
              )}
            >
              {toPersianDigits(d)}
              {mark && <span aria-hidden className={cn('absolute bottom-1 size-1 rounded-full', selected ? 'bg-fg-on-accent' : DOT[mark])} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
