'use client';

import { Button as BaseButton } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Spinner } from './Spinner';

export const buttonVariants = cva(
  [
    'ds-focus inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-semibold select-none',
    'transition-[background-color,color,transform,opacity] duration-(--ds-duration-fast) ease-standard',
    'active:scale-[0.98] disabled:pointer-events-none data-disabled:pointer-events-none',
    'disabled:opacity-45 data-disabled:opacity-45',
  ],
  {
    variants: {
      variant: {
        /** One per screen. The main action. */
        primary: 'bg-accent text-fg-on-accent hover:bg-accent-hover',
        /** Neutral action next to a primary. */
        secondary: 'bg-hover text-fg hover:bg-pressed',
        /** Tinted accent. Good for in-card actions. */
        soft: 'bg-accent-soft text-accent-ink hover:bg-accent/25',
        /** Text-only. Lowest emphasis. */
        ghost: 'bg-transparent text-fg-muted hover:bg-hover hover:text-fg',
        /** Destructive, needs confirmation. */
        danger: 'bg-negative-soft text-negative-ink hover:bg-negative/25',
        /** Inline link-style action. */
        link: 'h-auto bg-transparent p-0 text-accent-ink underline-offset-4 hover:underline active:scale-100',
      },
      size: {
        sm: 'h-8 rounded-control px-3 text-caption',
        md: 'h-11 rounded-control px-4 text-callout',
        lg: 'h-13 rounded-card px-6 text-body',
      },
      fullWidth: { true: 'w-full', false: '' },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'primary', size: 'md', fullWidth: false },
  }
);

export interface ButtonProps
  extends Omit<ComponentProps<typeof BaseButton>, 'className'>,
    VariantProps<typeof buttonVariants> {
  className?: string;
  /** Icon before the label (right side in RTL). */
  startIcon?: ReactNode;
  /** Icon after the label (left side in RTL). */
  endIcon?: ReactNode;
  /** Shows a spinner and blocks clicks. Keeps the button width. */
  loading?: boolean;
}

/**
 * Button. Use `render={<Link href="…" />}` with `nativeButton={false}`
 * to render a Next.js link with button styles.
 */
export function Button({
  variant,
  size,
  fullWidth,
  className,
  startIcon,
  endIcon,
  loading = false,
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <BaseButton
      type={type}
      disabled={disabled || loading}
      focusableWhenDisabled={loading}
      aria-busy={loading || undefined}
      className={cn(buttonVariants({ variant, size, fullWidth }), loading && 'relative', className)}
      {...props}
    >
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner size="sm" />
        </span>
      )}
      <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>
        {startIcon && <span className="inline-flex shrink-0 [&_svg]:size-[1.15em]">{startIcon}</span>}
        {children}
        {endIcon && <span className="inline-flex shrink-0 [&_svg]:size-[1.15em]">{endIcon}</span>}
      </span>
    </BaseButton>
  );
}
