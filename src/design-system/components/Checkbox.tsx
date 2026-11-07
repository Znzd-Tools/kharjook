'use client';

import { Checkbox as BaseCheckbox } from '@base-ui/react/checkbox';
import { Check, Minus } from '../icons';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  description?: ReactNode;
  'aria-label'?: string;
  className?: string;
}

/** Multi-select item (e.g. bulk select transactions). */
export function Checkbox({ label, description, className, onCheckedChange, indeterminate, ...props }: CheckboxProps) {
  const box = (
    <BaseCheckbox.Root
      indeterminate={indeterminate}
      onCheckedChange={onCheckedChange ? (c) => onCheckedChange(c) : undefined}
      className={cn(
        'ds-focus touch-target flex size-5.5 shrink-0 items-center justify-center rounded-[0.4rem] border-2 border-line-strong',
        'transition-colors duration-(--ds-duration-fast)',
        'data-checked:border-accent data-checked:bg-accent data-indeterminate:border-accent data-indeterminate:bg-accent',
        'data-disabled:opacity-45'
      )}
      {...props}
    >
      <BaseCheckbox.Indicator className="flex text-fg-on-accent data-unchecked:hidden [&_svg]:size-3.5 [&_svg]:stroke-3">
        {indeterminate ? <Minus /> : <Check />}
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
  if (!label) return <span className={cn('inline-flex', className)}>{box}</span>;
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', className)}>
      <span className="pt-0.5">{box}</span>
      <span className="flex min-w-0 flex-col">
        <span className="text-callout text-fg">{label}</span>
        {description && <span className="text-caption text-fg-subtle">{description}</span>}
      </span>
    </label>
  );
}
