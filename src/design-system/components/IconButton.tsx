'use client';

import { Button as BaseButton } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '../lib/cn';

export const iconButtonVariants = cva(
  [
    'ds-focus touch-target inline-flex shrink-0 items-center justify-center select-none',
    'transition-[background-color,color,transform] duration-(--ds-duration-fast) ease-standard',
    'active:scale-95 disabled:opacity-45 disabled:pointer-events-none',
  ],
  {
    variants: {
      variant: {
        ghost: 'bg-transparent text-fg-muted hover:bg-hover hover:text-fg',
        secondary: 'bg-hover text-fg hover:bg-pressed',
        primary: 'bg-accent text-fg-on-accent hover:bg-accent-hover',
        soft: 'bg-accent-soft text-accent-ink hover:bg-accent/25',
        danger: 'bg-transparent text-negative-ink hover:bg-negative-soft',
      },
      size: {
        sm: 'size-8 rounded-[0.625rem] [&_svg]:size-4',
        md: 'size-10 rounded-control [&_svg]:size-5',
        lg: 'size-12 rounded-card [&_svg]:size-6',
      },
      shape: { square: '', circle: 'rounded-full' },
    },
    defaultVariants: { variant: 'ghost', size: 'md', shape: 'square' },
  }
);

export interface IconButtonProps
  extends Omit<ComponentProps<typeof BaseButton>, 'className' | 'children'>,
    VariantProps<typeof iconButtonVariants> {
  /** Required: icon-only buttons need an accessible name. */
  'aria-label': string;
  icon: ReactNode;
  className?: string;
}

/** Icon-only button. Has a 44px touch target even at small sizes. */
export function IconButton({ variant, size, shape, icon, className, type = 'button', ...props }: IconButtonProps) {
  return (
    <BaseButton type={type} className={cn(iconButtonVariants({ variant, size, shape }), className)} {...props}>
      {icon}
    </BaseButton>
  );
}
