import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

export const badgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full font-medium tabular [&_svg]:size-3',
  {
    variants: {
      tone: {
        neutral: 'bg-hover text-fg-muted',
        accent: 'bg-accent-soft text-accent-ink',
        positive: 'bg-positive-soft text-positive-ink',
        negative: 'bg-negative-soft text-negative-ink',
        warning: 'bg-warning-soft text-warning-ink',
        info: 'bg-info-soft text-info-ink',
        solid: 'bg-accent text-fg-on-accent',
      },
      size: { sm: 'h-5 px-1.5 text-micro', md: 'h-6 px-2 text-caption' },
    },
    defaultVariants: { tone: 'neutral', size: 'sm' },
  }
);

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  icon?: ReactNode;
  /** Show a leading status dot. */
  dot?: boolean;
}

/** Small status label. Pair color with text — never color alone. */
export function Badge({ tone, size, icon, dot, className, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {icon}
      {children}
    </span>
  );
}

export interface CounterBadgeProps {
  count: number;
  /** Values above max show as "max+". Default 99. */
  max?: number;
  className?: string;
}

/** Notification counter. Hidden when count is 0. */
export function CounterBadge({ count, max = 99, className }: CounterBadgeProps) {
  if (count <= 0) return null;
  const label = count > max ? `${max}+` : String(count);
  return (
    <span
      className={cn(
        'inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-negative px-1 text-micro text-fg-on-accent tabular',
        className
      )}
    >
      {label.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]!)}
    </span>
  );
}
