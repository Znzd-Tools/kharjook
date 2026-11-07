import { useRender } from '@base-ui/react/use-render';
import { mergeProps } from '@base-ui/react/merge-props';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

export const textVariants = cva('', {
  variants: {
    variant: {
      display: 'text-display',
      headline: 'text-headline',
      title: 'text-title',
      body: 'text-body',
      callout: 'text-callout',
      caption: 'text-caption',
      micro: 'text-micro',
    },
    tone: {
      default: 'text-fg',
      muted: 'text-fg-muted',
      subtle: 'text-fg-subtle',
      accent: 'text-accent-ink',
      positive: 'text-positive-ink',
      negative: 'text-negative-ink',
      warning: 'text-warning-ink',
      inherit: '',
    },
    weight: { regular: 'font-normal', medium: 'font-medium', semibold: 'font-semibold', bold: 'font-extrabold' },
    numeric: { true: 'tabular', false: '' },
    truncate: { true: 'truncate', false: '' },
  },
  defaultVariants: { variant: 'body', tone: 'default', numeric: false, truncate: false },
});

const DEFAULT_TAG = {
  display: 'h1',
  headline: 'h2',
  title: 'h3',
  body: 'p',
  callout: 'p',
  caption: 'p',
  micro: 'span',
} as const;

export interface TextProps extends useRender.ComponentProps<'p'>, VariantProps<typeof textVariants> {}

/**
 * Typography. The only way to set text size and tone.
 * Change the tag with `render={<span />}`.
 */
export function Text({ variant, tone, weight, numeric, truncate, className, render, ...props }: TextProps) {
  return useRender({
    defaultTagName: DEFAULT_TAG[variant ?? 'body'],
    render,
    props: mergeProps<'p'>({ className: cn(textVariants({ variant, tone, weight, numeric, truncate }), className) }, props),
  });
}
