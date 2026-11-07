'use client';

import { Radio } from '@base-ui/react/radio';
import { RadioGroup as BaseRadioGroup } from '@base-ui/react/radio-group';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface RadioOption {
  value: string;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
}

export interface RadioGroupProps {
  options: RadioOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** `list`: plain rows. `card`: each option is a selectable card. */
  variant?: 'list' | 'card';
  'aria-label': string;
  className?: string;
}

/** Single choice from 2–6 visible options. More options → `PickerSheet`. */
export function RadioGroup({ options, variant = 'list', className, onValueChange, ...props }: RadioGroupProps) {
  return (
    <BaseRadioGroup
      className={cn('flex flex-col', variant === 'card' ? 'gap-2' : 'gap-3', className)}
      onValueChange={onValueChange ? (v) => onValueChange(v as string) : undefined}
      {...props}
    >
      {options.map((o) => (
        <label
          key={o.value}
          className={cn(
            'flex cursor-pointer items-start gap-3',
            variant === 'card' &&
              'rounded-card border border-line p-3.5 transition-colors has-data-checked:border-accent has-data-checked:bg-accent-soft',
            o.disabled && 'cursor-not-allowed opacity-45'
          )}
        >
          <Radio.Root
            value={o.value}
            disabled={o.disabled}
            className={cn(
              'ds-focus mt-0.5 flex size-5.5 shrink-0 items-center justify-center rounded-full border-2 border-line-strong',
              'transition-colors data-checked:border-accent'
            )}
          >
            <Radio.Indicator className="size-2.5 rounded-full bg-accent data-unchecked:hidden" />
          </Radio.Root>
          <span className="flex min-w-0 flex-col">
            <span className="text-callout text-fg">{o.label}</span>
            {o.description && <span className="text-caption text-fg-subtle">{o.description}</span>}
          </span>
        </label>
      ))}
    </BaseRadioGroup>
  );
}
