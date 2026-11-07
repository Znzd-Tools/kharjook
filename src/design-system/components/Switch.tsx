'use client';

import { Switch as BaseSwitch } from '@base-ui/react/switch';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  /** Row label. Without it, pass `aria-label`. */
  label?: ReactNode;
  description?: ReactNode;
  'aria-label'?: string;
  className?: string;
}

/** On/off setting that applies at once (no save button). */
export function Switch({ label, description, className, onCheckedChange, ...props }: SwitchProps) {
  const control = (
    <BaseSwitch.Root
      onCheckedChange={onCheckedChange ? (c) => onCheckedChange(c) : undefined}
      className={cn(
        'ds-focus relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full bg-line-strong p-0.5',
        'transition-colors duration-(--ds-duration-base) ease-standard data-checked:bg-accent',
        'data-disabled:cursor-not-allowed data-disabled:opacity-45'
      )}
      {...props}
    >
      <BaseSwitch.Thumb
        className={cn(
          'block size-6 rounded-full bg-white shadow-raised data-checked:bg-fg-on-accent',
          'transition-transform duration-(--ds-duration-base) ease-emphasized',
          'rtl:data-checked:-translate-x-5 ltr:data-checked:translate-x-5'
        )}
      />
    </BaseSwitch.Root>
  );
  if (!label) return <span className={className}>{control}</span>;
  return (
    <label className={cn('flex cursor-pointer items-center justify-between gap-4', className)}>
      <span className="flex min-w-0 flex-col">
        <span className="text-callout font-medium text-fg">{label}</span>
        {description && <span className="text-caption text-fg-subtle">{description}</span>}
      </span>
      {control}
    </label>
  );
}
