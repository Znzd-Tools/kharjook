'use client';

import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';
import type { ReactElement, ReactNode } from 'react';

export interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Hover/focus hint for desktop and keyboard users. Never put required
 * information in a tooltip — touch users cannot hover.
 */
export function Tooltip({ content, children, side = 'top' }: TooltipProps) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={6} className="z-(--ds-z-popover)">
          <BaseTooltip.Popup
            dir="rtl"
            className="origin-(--transform-origin) rounded-control bg-fg px-2.5 py-1.5 text-caption text-canvas shadow-overlay transition-[opacity,scale] duration-(--ds-duration-fast) data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:opacity-0"
          >
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}

export const TooltipProvider = BaseTooltip.Provider;
