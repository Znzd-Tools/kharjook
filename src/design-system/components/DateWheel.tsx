'use client';

/**
 * Scroll-wheel Jalali date picker (day · month · year), iOS style.
 * The default date picker of the app: DateField opens it in a sheet.
 */
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  JALALI_MONTHS,
  formatJalaali,
  jalaaliMonthLength,
  parseJalaali,
  todayJalaali,
  type JalaaliDate,
} from '@/shared/utils/jalali';
import { cn } from '../lib/cn';
import { Button } from './Button';

const ITEM = 40;
const VISIBLE = 5;
const PAD = ((VISIBLE - 1) / 2) * ITEM;
const fa = (n: number) => String(n).replace(/\d/g, (c) => '۰۱۲۳۴۵۶۷۸۹'[Number(c)]!);

export interface DateWheelProps {
  /** Canonical `YYYY/MM/DD`. Empty = today. */
  value: string;
  onConfirm: (value: string) => void;
  onCancel?: () => void;
  minYear?: number;
  maxYear?: number;
}

export function DateWheel({ value, onConfirm, onCancel, minYear, maxYear }: DateWheelProps) {
  const today = useMemo(() => todayJalaali(), []);
  const [draft, setDraft] = useState<JalaaliDate>(() => parseJalaali(value) ?? today);
  const yStart = Math.min(minYear ?? today.jy - 15, draft.jy);
  const yEnd = Math.max(maxYear ?? today.jy + 5, draft.jy);
  const len = jalaaliMonthLength(draft.jy, draft.jm);
  const eff: JalaaliDate = draft.jd > len ? { ...draft, jd: len } : draft;

  const years = useMemo(() => Array.from({ length: yEnd - yStart + 1 }, (_, i) => yStart + i), [yStart, yEnd]);
  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const days = useMemo(() => Array.from({ length: len }, (_, i) => i + 1), [len]);

  return (
    <div className="space-y-5">
      <div className="relative flex justify-center gap-1" style={{ height: ITEM * VISIBLE }} dir="rtl">
        <div className="pointer-events-none absolute inset-x-1 rounded-control bg-hover" style={{ top: PAD, height: ITEM }} aria-hidden />
        <Wheel label="روز" className="flex-1" items={days} render={fa} value={eff.jd} onChange={(jd) => setDraft((p) => ({ ...p, jd }))} />
        <Wheel label="ماه" className="flex-[1.4]" items={months} render={(m) => JALALI_MONTHS[m - 1]!} value={eff.jm} onChange={(jm) => setDraft((p) => ({ ...p, jm }))} />
        <Wheel label="سال" className="flex-1" items={years} render={fa} value={eff.jy} onChange={(jy) => setDraft((p) => ({ ...p, jy }))} />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="soft" onClick={() => setDraft(today)}>
          امروز
        </Button>
        <div className="flex-1" />
        {onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            انصراف
          </Button>
        )}
        <Button onClick={() => onConfirm(formatJalaali(eff))}>تأیید</Button>
      </div>
    </div>
  );
}

function Wheel({
  label,
  items,
  render,
  value,
  onChange,
  className,
}: {
  label: string;
  items: number[];
  render: (v: number) => string;
  value: number;
  onChange: (v: number) => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<number | null>(null);
  const programmatic = useRef(false);
  const index = Math.max(0, items.indexOf(value));

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    programmatic.current = true;
    el.scrollTop = index * ITEM;
    const t = window.setTimeout(() => {
      programmatic.current = false;
    }, 80);
    return () => window.clearTimeout(t);
  }, [index]);

  const onScroll = () => {
    if (programmatic.current) return;
    const el = ref.current;
    if (!el) return;
    if (settle.current != null) window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const i = Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / ITEM)));
      if (Math.abs(el.scrollTop - i * ITEM) > 1) {
        programmatic.current = true;
        el.scrollTo({ top: i * ITEM, behavior: 'smooth' });
        window.setTimeout(() => {
          programmatic.current = false;
        }, 150);
      }
      const next = items[i];
      if (next !== undefined && next !== value) onChange(next);
    }, 100);
  };

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={label}
      onScroll={onScroll}
      className={cn('relative min-w-0 snap-y snap-mandatory overflow-y-scroll scrollbar-hide touch-pan-y', className)}
      style={{ paddingTop: PAD, paddingBottom: PAD, height: ITEM * VISIBLE }}
    >
      {items.map((it) => (
        <div
          key={it}
          role="option"
          aria-selected={it === value}
          onClick={() => onChange(it)}
          className={cn('flex cursor-pointer snap-center items-center justify-center text-callout transition-colors', it === value ? 'font-bold text-fg' : 'text-fg-subtle')}
          style={{ height: ITEM }}
        >
          {render(it)}
        </div>
      ))}
    </div>
  );
}
