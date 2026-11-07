import { Avatar as BaseAvatar } from '@base-ui/react/avatar';
import { cva, type VariantProps } from 'class-variance-authority';
import type { CSSProperties, ReactNode } from 'react';
import { cn } from '../lib/cn';

export const avatarVariants = cva(
  'relative inline-flex shrink-0 items-center justify-center overflow-hidden select-none font-semibold',
  {
    variants: {
      size: {
        xs: 'size-6 text-micro [&_svg]:size-3.5',
        sm: 'size-8 text-caption [&_svg]:size-4',
        md: 'size-10 text-callout [&_svg]:size-5',
        lg: 'size-12 text-body [&_svg]:size-6',
        xl: 'size-16 text-title [&_svg]:size-8',
      },
      shape: { rounded: 'rounded-control', circle: 'rounded-full' },
      tone: {
        neutral: 'bg-hover text-fg-muted',
        accent: 'bg-accent-soft text-accent-ink',
        positive: 'bg-positive-soft text-positive-ink',
        negative: 'bg-negative-soft text-negative-ink',
        warning: 'bg-warning-soft text-warning-ink',
        info: 'bg-info-soft text-info-ink',
        rose: 'bg-tint-rose-soft text-tint-rose-ink',
        peach: 'bg-tint-peach-soft text-tint-peach-ink',
        lemon: 'bg-tint-lemon-soft text-tint-lemon-ink',
        mint: 'bg-tint-mint-soft text-tint-mint-ink',
        sky: 'bg-tint-sky-soft text-tint-sky-ink',
        lilac: 'bg-tint-lilac-soft text-tint-lilac-ink',
        custom: '',
      },
    },
    defaultVariants: { size: 'md', shape: 'circle', tone: 'neutral' },
  }
);

export interface AvatarProps extends VariantProps<typeof avatarVariants> {
  /** Uploaded image URL (e.g. an entity icon from storage). */
  src?: string | null;
  /** Fallback when there is no image: an icon or initials. */
  fallback?: ReactNode;
  /** Name for initials and alt text. */
  name?: string;
  /** Custom tint for entity colors. Sets tone to "custom". */
  color?: string;
  className?: string;
}

function initials(name?: string) {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).map((p) => p[0]).join('‌');
}

/**
 * Entity image for assets, wallets, persons, categories.
 * Replaces the old `EntityIcon`.
 */
export function Avatar({ src, fallback, name, color, size, shape, tone, className }: AvatarProps) {
  const style: CSSProperties | undefined = color
    ? { backgroundColor: `color-mix(in oklab, ${color} 16%, transparent)`, color }
    : undefined;
  return (
    <BaseAvatar.Root
      className={cn(avatarVariants({ size, shape, tone: color ? 'custom' : tone }), className)}
      style={style}
    >
      {src && <BaseAvatar.Image src={src} alt={name ?? ''} className="size-full object-cover" draggable={false} />}
      <BaseAvatar.Fallback className="inline-flex size-full items-center justify-center">
        {fallback ?? initials(name)}
      </BaseAvatar.Fallback>
    </BaseAvatar.Root>
  );
}
