import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface StatTileProps {
  label: ReactNode;
  /** Main value — usually an `Amount`. */
  value: ReactNode;
  /** Secondary line — usually a `Delta` or caption text. */
  meta?: ReactNode;
  icon?: ReactNode;
  /** Optional mini chart under the value (e.g. `Sparkline`). */
  chart?: ReactNode;
  onClick?: () => void;
  className?: string;
}

/** Single number with a label. Use instead of a chart when one number tells the story. */
export function StatTile({ label, value, meta, icon, chart, onClick, className }: StatTileProps) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex min-w-0 flex-col gap-1 rounded-card bg-panel p-4 text-start',
        onClick && 'ds-focus transition-colors hover:bg-hover active:bg-pressed',
        className
      )}
    >
      <span className="flex items-center gap-1.5 text-caption text-fg-subtle [&_svg]:size-3.5">
        {icon}
        {label}
      </span>
      <span className="min-w-0 truncate">{value}</span>
      {meta && <span className="text-caption text-fg-subtle">{meta}</span>}
      {chart && <span className="mt-2 block">{chart}</span>}
    </Tag>
  );
}
