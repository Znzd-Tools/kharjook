'use client';

import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

const chipBase = [
  'ds-focus inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-caption font-medium select-none',
  'border border-line bg-transparent text-fg-muted',
  'transition-[background-color,border-color,color] duration-(--ds-duration-fast) ease-standard',
  'hover:bg-hover hover:text-fg active:scale-[0.97]',
  'data-pressed:border-transparent data-pressed:bg-accent-soft data-pressed:text-accent-ink',
  'disabled:opacity-45 [&_svg]:size-3.5',
].join(' ');

export interface ChipProps {
  value?: string;
  pressed?: boolean;
  defaultPressed?: boolean;
  onPressedChange?: (pressed: boolean) => void;
  icon?: ReactNode;
  /** Shows a small count after the label. */
  count?: number;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

/** Toggleable filter chip. Use inside `ChipGroup` for single/multi select. */
export function Chip({ icon, count, className, children, onPressedChange, ...props }: ChipProps) {
  return (
    <Toggle
      className={cn(chipBase, className)}
      onPressedChange={onPressedChange ? (p) => onPressedChange(p) : undefined}
      {...props}
    >
      {icon}
      {children}
      {count != null && (
        <span className="tabular opacity-70">
          {String(count).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!)}
        </span>
      )}
    </Toggle>
  );
}

export interface ChipGroupProps {
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** Allow many chips at once. Default false (single select). */
  multiple?: boolean;
  /** Scroll horizontally instead of wrapping. Default true. */
  scroll?: boolean;
  'aria-label': string;
  className?: string;
  children: ReactNode;
}

/** A row of chips. Scrolls horizontally on small screens. */
export function ChipGroup({ scroll = true, className, onValueChange, children, ...props }: ChipGroupProps) {
  return (
    <ToggleGroup
      className={cn(
        'flex gap-2',
        scroll ? '-mx-(--ds-gutter) overflow-x-auto px-(--ds-gutter) scrollbar-hide' : 'flex-wrap',
        className
      )}
      onValueChange={onValueChange ? (v) => onValueChange(v as string[]) : undefined}
      {...props}
    >
      {children}
    </ToggleGroup>
  );
}

export interface InputChipProps {
  children: ReactNode;
  icon?: ReactNode;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
}

/** Static chip for a chosen value (e.g. an active filter) with optional remove. */
export function InputChip({ children, icon, onRemove, removeLabel = 'حذف', className }: InputChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-accent-soft ps-3 text-caption font-medium text-accent-ink [&_svg]:size-3.5',
        onRemove ? 'pe-1' : 'pe-3',
        className
      )}
    >
      {icon}
      {children}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className="ds-focus inline-flex size-6 items-center justify-center rounded-full hover:bg-accent/20"
        >
          <X />
        </button>
      )}
    </span>
  );
}
