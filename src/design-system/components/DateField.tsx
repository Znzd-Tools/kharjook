'use client';

import { CalendarDays } from '../icons';
import { useState } from 'react';
import { addDays, equalsJalaali, formatJalaali, formatJalaaliHuman, parseJalaali, todayJalaali } from '@/shared/utils/jalali';
import { cn } from '../lib/cn';
import { DateWheel } from './DateWheel';
import { Chip, ChipGroup } from './Chip';
import { controlBox, useField } from './Field';
import { Sheet } from './Sheet';

export interface DateFieldProps {
  /** Canonical Jalali string `YYYY/MM/DD` (same shape as the DB). */
  value: string;
  onValueChange: (value: string) => void;
  /** Show امروز / دیروز chips next to the field. Default true. */
  quickChips?: boolean;
  className?: string;
}

/** Jalali date input. Quick chips cover ~90% of entries in one tap. */
export function DateField({ value, onValueChange, quickChips = true, className }: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const field = useField();
  const parsed = parseJalaali(value);
  const today = todayJalaali();
  const yesterday = addDays(today, -1);
  const quick = parsed && equalsJalaali(parsed, today) ? 'today' : parsed && equalsJalaali(parsed, yesterday) ? 'yesterday' : null;
  const label = quick === 'today' ? 'امروز' : quick === 'yesterday' ? 'دیروز' : parsed ? formatJalaaliHuman(parsed) : 'انتخاب تاریخ';

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <button
        type="button"
        id={field?.id}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(controlBox, 'ds-focus h-12 cursor-pointer text-start')}
      >
        <CalendarDays className="size-4.5 shrink-0 text-fg-subtle" aria-hidden />
        <span className="flex-1">{label}</span>
        {quick && parsed && <span className="text-caption text-fg-subtle">{formatJalaaliHuman(parsed)}</span>}
      </button>
      {quickChips && (
        <ChipGroup
          aria-label="تاریخ سریع"
          value={quick ? [quick] : []}
          onValueChange={(v) => {
            if (v[0] === 'today') onValueChange(formatJalaali(today));
            if (v[0] === 'yesterday') onValueChange(formatJalaali(yesterday));
          }}
        >
          <Chip value="today">امروز</Chip>
          <Chip value="yesterday">دیروز</Chip>
          <Chip value="other" pressed={Boolean(parsed && !quick)} onPressedChange={() => setOpen(true)}>
            تاریخ دیگر
          </Chip>
        </ChipGroup>
      )}
      <Sheet open={open} onOpenChange={setOpen} title="انتخاب تاریخ">
        {open && (
          <DateWheel
            value={value}
            onConfirm={(v) => {
              onValueChange(v);
              setOpen(false);
            }}
            onCancel={() => setOpen(false)}
          />
        )}
      </Sheet>
    </div>
  );
}
