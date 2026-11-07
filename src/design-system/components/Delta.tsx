import { ArrowDownLeft, ArrowUpLeft, Minus } from '../icons';
import { cn } from '../lib/cn';
import { formatPercent } from '../lib/format';

export interface DeltaProps {
  /** Percent value, e.g. 12.5 for +12.5%. */
  value: number;
  /** Show as a tinted pill. Default false (inline text). */
  pill?: boolean;
  /** Invert colors (e.g. for expenses, where up is bad). */
  invert?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

/** Change indicator: arrow + signed percent. Color is never the only cue. */
export function Delta({ value, pill, invert, size = 'sm', className }: DeltaProps) {
  const up = value > 0;
  const flat = value === 0;
  const good = flat ? null : invert ? !up : up;
  const Icon = flat ? Minus : up ? ArrowUpLeft : ArrowDownLeft;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-medium tabular',
        size === 'sm' ? 'text-caption [&_svg]:size-3.5' : 'text-callout [&_svg]:size-4',
        good === null ? 'text-fg-subtle' : good ? 'text-positive-ink' : 'text-negative-ink',
        pill && 'rounded-full px-1.5 py-0.5',
        pill && (good === null ? 'bg-hover' : good ? 'bg-positive-soft' : 'bg-negative-soft'),
        className
      )}
    >
      <Icon aria-hidden />
      <span dir="ltr">{formatPercent(value)}</span>
    </span>
  );
}
