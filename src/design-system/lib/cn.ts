import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge does not know our custom token names. Without this config
 * `text-title text-fg` would merge as two colors and drop one class.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['display', 'headline', 'title', 'body', 'callout', 'caption', 'micro'],
      radius: ['control', 'card', 'sheet'],
      shadow: ['raised', 'overlay', 'fab'],
      ease: ['standard', 'emphasized', 'exit'],
    },
  },
});

/** Merge class names. Later classes win over earlier conflicting ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
