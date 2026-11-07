import { cn } from '../lib/cn';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Screen-reader text. Default: "در حال بارگذاری". */
  label?: string;
}

const SIZES = { sm: 'size-4 border-2', md: 'size-5 border-2', lg: 'size-8 border-[3px]' } as const;

/** Indeterminate loading indicator. Inherits the current text color. */
export function Spinner({ size = 'md', className, label = 'در حال بارگذاری' }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex', className)}>
      <span
        aria-hidden
        className={cn(
          'animate-ds-spin rounded-full border-current border-e-transparent opacity-80',
          SIZES[size]
        )}
      />
    </span>
  );
}
