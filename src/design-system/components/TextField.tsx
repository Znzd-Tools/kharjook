'use client';

import { Search, X } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { controlBox, useField } from './Field';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  /** Icon or text at the start side. */
  startAdornment?: ReactNode;
  /** Icon, unit or button at the end side. */
  endAdornment?: ReactNode;
  size?: 'md' | 'lg';
  invalid?: boolean;
}

/** Text input. Use inside `Field` for label and errors. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { startAdornment, endAdornment, size = 'md', invalid, className, id, disabled, ...props },
  ref
) {
  const field = useField();
  return (
    <div className={cn(controlBox, size === 'md' ? 'h-12' : 'h-14', disabled && 'pointer-events-none', className)}>
      {startAdornment && <span className="flex shrink-0 text-fg-subtle [&_svg]:size-4.5">{startAdornment}</span>}
      <input
        ref={ref}
        id={id ?? field?.id}
        disabled={disabled ?? field?.disabled}
        aria-invalid={invalid ?? field?.invalid ?? undefined}
        aria-describedby={field?.errorId ?? field?.descriptionId}
        className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-fg-disabled"
        {...props}
      />
      {endAdornment && <span className="flex shrink-0 items-center text-caption text-fg-subtle [&_svg]:size-4.5">{endAdornment}</span>}
    </div>
  );
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

/** Multi-line text, e.g. a transaction note. Grows with content. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, id, rows = 3, ...props },
  ref
) {
  const field = useField();
  return (
    <div className={cn(controlBox, 'items-start py-3', className)}>
      <textarea
        ref={ref}
        id={id ?? field?.id}
        rows={rows}
        aria-invalid={invalid ?? field?.invalid ?? undefined}
        aria-describedby={field?.errorId ?? field?.descriptionId}
        className="field-sizing-content min-h-[4.5rem] w-full resize-none bg-transparent outline-none placeholder:text-fg-disabled"
        {...props}
      />
    </div>
  );
});

export interface SearchFieldProps extends Omit<InputProps, 'startAdornment' | 'endAdornment' | 'onChange' | 'value'> {
  value: string;
  onValueChange: (value: string) => void;
}

/** Search input with clear button. */
export function SearchField({ value, onValueChange, placeholder = 'جستجو', className, ...props }: SearchFieldProps) {
  return (
    <Input
      type="search"
      enterKeyHint="search"
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      placeholder={placeholder}
      aria-label={props['aria-label'] ?? placeholder}
      startAdornment={<Search />}
      endAdornment={
        value ? (
          <button
            type="button"
            aria-label="پاک کردن"
            onClick={() => onValueChange('')}
            className="ds-focus inline-flex size-6 items-center justify-center rounded-full bg-hover text-fg-muted [&_svg]:size-3.5"
          >
            <X />
          </button>
        ) : null
      }
      className={cn('h-11 rounded-full [&_input::-webkit-search-cancel-button]:hidden', className)}
      {...props}
    />
  );
}
