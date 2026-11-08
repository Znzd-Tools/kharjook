'use client';

import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Check } from '../icons';

export interface Choice<T extends string = string> {
  value: T;
  label: string;
  icon: ReactNode;
  /** Entity color (e.g. category color). */
  color?: string;
  /** Pastel tint name instead of a raw color. */
  tint?: 'rose' | 'peach' | 'lemon' | 'mint' | 'sky' | 'lilac';
}

const TINT = {
  rose: 'bg-tint-rose-soft text-tint-rose-ink',
  peach: 'bg-tint-peach-soft text-tint-peach-ink',
  lemon: 'bg-tint-lemon-soft text-tint-lemon-ink',
  mint: 'bg-tint-mint-soft text-tint-mint-ink',
  sky: 'bg-tint-sky-soft text-tint-sky-ink',
  lilac: 'bg-tint-lilac-soft text-tint-lilac-ink',
} as const;

export interface ChoiceGridProps<T extends string = string> {
  choices: Choice<T>[];
  value: T | null;
  onValueChange: (value: T) => void;
  columns?: 3 | 4 | 5;
  /** Extra tile at the end, e.g. "همه" that opens a PickerSheet. */
  trailingTile?: ReactNode;
  'aria-label': string;
  className?: string;
}

/**
 * Icon tiles for fast one-tap choice (top categories, transaction type).
 * Show the 7–11 most used choices; put the rest behind a "more" tile.
 */
export function ChoiceGrid<T extends string>({
  choices,
  value,
  onValueChange,
  columns = 4,
  trailingTile,
  className,
  ...props
}: ChoiceGridProps<T>) {
  return (
    <RadioGroup
      // Always controlled: '' = nothing selected (no tile has an empty value).
      value={value ?? ('' as T)}
      onValueChange={(v) => onValueChange(v as T)}
      className={cn('grid gap-2', { 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5' }[columns], className)}
      {...props}
    >
      {choices.map((c) => (
        <Radio.Root
          key={c.value}
          value={c.value}
          className={cn(
            'ds-focus group relative flex cursor-pointer flex-col items-center gap-1.5 rounded-card px-1 py-2.5 select-none',
            'transition-[background-color,transform,box-shadow] duration-(--ds-duration-fast) hover:bg-hover active:scale-95',
            // Selected: the whole tile is marked, so a category's own color can never hide it.
            'data-checked:bg-accent-soft data-checked:ring-2 data-checked:ring-accent data-checked:ring-inset'
          )}
        >
          <span
            className={cn(
              'flex size-12 items-center justify-center rounded-[38%] transition-[background-color,color,transform] duration-(--ds-duration-base) ease-emphasized group-data-checked:scale-110 [&_svg]:size-5.5',
              c.tint ? TINT[c.tint] : 'bg-hover text-fg-muted',
              'group-data-checked:bg-accent group-data-checked:text-fg-on-accent'
            )}
            style={c.color ? { color: c.color, backgroundColor: `color-mix(in oklab, ${c.color} 15%, transparent)` } : undefined}
          >
            {c.icon}
          </span>
          <span className="w-full truncate text-center text-micro text-fg-muted group-data-checked:font-bold group-data-checked:text-accent-ink">
            {c.label}
          </span>
          <span
            aria-hidden
            className="absolute top-1 end-1 hidden size-4.5 items-center justify-center rounded-full bg-accent text-fg-on-accent group-data-checked:flex [&_svg]:size-3"
          >
            <Check />
          </span>
        </Radio.Root>
      ))}
      {trailingTile}
    </RadioGroup>
  );
}
