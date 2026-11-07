'use client';

import { Radio } from '@base-ui/react/radio';
import { RadioGroup } from '@base-ui/react/radio-group';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface SegmentOption<T extends string = string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  'aria-label': string;
  className?: string;
}

/**
 * 2–4 mutually exclusive views of the same content
 * (e.g. دارایی‌ها / کیف پول‌ها, تومان / دلار, ماه / سال).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onValueChange,
  size = 'md',
  fullWidth = true,
  className,
  ...props
}: SegmentedControlProps<T>) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(v) => onValueChange(v as T)}
      className={cn(
        'inline-flex gap-1 rounded-full bg-sunken p-1',
        fullWidth && 'flex w-full',
        className
      )}
      {...props}
    >
      {options.map((o) => (
        <Radio.Root
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            'ds-focus inline-flex flex-1 cursor-pointer select-none items-center justify-center gap-1.5 rounded-full px-3 font-medium whitespace-nowrap',
            'text-fg-muted transition-[background-color,color,box-shadow] duration-(--ds-duration-fast) ease-standard',
            'hover:text-fg data-checked:bg-elevated data-checked:text-fg data-checked:shadow-raised',
            'data-disabled:opacity-45 [&_svg]:size-4',
            size === 'md' ? 'h-9 text-callout' : 'h-7 text-caption'
          )}
        >
          {o.icon}
          {o.label}
        </Radio.Root>
      ))}
    </RadioGroup>
  );
}
