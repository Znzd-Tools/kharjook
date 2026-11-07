'use client';

import { createContext, useContext, useId, type ReactNode } from 'react';
import { cn } from '../lib/cn';

interface FieldContextValue {
  id: string;
  descriptionId?: string;
  errorId?: string;
  invalid: boolean;
  disabled: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Read field ids for custom controls inside `Field`. */
export function useField() {
  return useContext(FieldContext);
}

export interface FieldProps {
  label?: ReactNode;
  /** Help text under the control. Hidden while an error shows. */
  hint?: ReactNode;
  error?: ReactNode;
  /** Text at the end of the label row (e.g. "اختیاری" or a counter). */
  labelEnd?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  /** Control id. Generated when omitted. */
  id?: string;
  children: ReactNode;
  className?: string;
}

/** Label + control + hint/error. Wrap every form control in a Field. */
export function Field({ label, hint, error, labelEnd, required, disabled = false, id, children, className }: FieldProps) {
  const autoId = useId();
  const controlId = id ?? autoId;
  const descriptionId = hint && !error ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  return (
    <FieldContext.Provider value={{ id: controlId, descriptionId, errorId, invalid: Boolean(error), disabled }}>
      <div className={cn('flex flex-col gap-1.5', disabled && 'opacity-60', className)}>
        {(label || labelEnd) && (
          <div className="flex items-center justify-between gap-2 px-1">
            {label && (
              <label htmlFor={controlId} className="text-caption font-medium text-fg-muted">
                {label}
                {required && <span className="ms-0.5 text-negative-ink" aria-hidden>*</span>}
              </label>
            )}
            {labelEnd && <span className="text-caption text-fg-subtle">{labelEnd}</span>}
          </div>
        )}
        {children}
        {error ? (
          <p id={errorId} className="px-1 text-caption text-negative-ink" role="alert">
            {error}
          </p>
        ) : hint ? (
          <p id={descriptionId} className="px-1 text-caption text-fg-subtle">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

/** Shared control box styles for inputs, pickers and textareas. */
export const controlBox = cn(
  'flex w-full items-center gap-2 rounded-control bg-sunken px-3.5 text-body text-fg',
  'border border-transparent transition-[border-color,background-color] duration-(--ds-duration-fast)',
  'focus-within:border-accent hover:bg-hover/50',
  'has-[[aria-invalid=true]]:border-negative'
);
