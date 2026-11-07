import { useRender } from '@base-ui/react/use-render';
import { mergeProps } from '@base-ui/react/merge-props';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

export const cardVariants = cva('rounded-card', {
  variants: {
    variant: {
      /** Default container on canvas. */
      filled: 'bg-panel',
      /** Low-emphasis container. */
      outline: 'border border-line bg-transparent',
      /** Tinted highlight (e.g. a suggestion). */
      accent: 'bg-accent-soft',
      /** Floating content (popovers). */
      elevated: 'bg-elevated shadow-raised',
      /** Inset area inside another card. */
      sunken: 'bg-sunken',
      /** Gradient hero, one per screen (net worth). Use tone="inherit" on Amount inside. */
      hero: 'relative isolate overflow-hidden bg-(image:--gradient-hero) text-fg-on-hero shadow-hero',
    },
    padding: { none: '', sm: 'p-3', md: 'p-4', lg: 'p-5' },
    interactive: {
      true: 'ds-focus cursor-pointer text-start transition-[background-color,transform] duration-(--ds-duration-fast) hover:bg-hover active:scale-[0.99]',
      false: '',
    },
  },
  defaultVariants: { variant: 'filled', padding: 'md', interactive: false },
});

export interface CardProps extends useRender.ComponentProps<'div'>, VariantProps<typeof cardVariants> {}

/**
 * Card. Use only when content needs a container. Prefer `List` for
 * collections and `Section` for titled groups.
 */
export function Card({ variant, padding, interactive, className, render, ...props }: CardProps) {
  return useRender({
    defaultTagName: 'div',
    render,
    props: mergeProps<'div'>({ className: cn(cardVariants({ variant, padding, interactive }), className) }, props),
  });
}
