'use client';

import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface Choice<T extends string = string> {
  value: T;
  label: string;
  icon: ReactNode;
  /** Entity color (e.g. category color). */
  color?: string;
}

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
      value={value ?? undefined}
      onValueChange={(v) => onValueChange(v as T)}
      className={cn('grid gap-2', { 3: 'grid-cols-3', 4: 'grid-cols-4', 5: 'grid-cols-5' }[columns], className)}
      {...props}
    >
      {choices.map((c) => (
        <Radio.Root
          key={c.value}
          value={c.value}
          className={cn(
            'ds-focus group flex cursor-pointer flex-col items-center gap-1.5 rounded-card px-1 py-2.5 select-none',
            'transition-[background-color,transform] duration-(--ds-duration-fast) hover:bg-hover active:scale-95',
            'data-checked:bg-accent-soft'
          )}
        >
          <span
            className="flex size-11 items-center justify-center rounded-full bg-hover text-fg-muted transition-colors group-data-checked:bg-accent group-data-checked:text-fg-on-accent [&_svg]:size-5"
            style={c.color ? { color: c.color, backgroundColor: `color-mix(in oklab, ${c.color} 15%, transparent)` } : undefined}
          >
            {c.icon}
          </span>
          <span className="w-full truncate text-center text-micro text-fg-muted group-data-checked:font-semibold group-data-checked:text-fg">
            {c.label}
          </span>
        </Radio.Root>
      ))}
      {trailingTile}
    </RadioGroup>
  );
}
