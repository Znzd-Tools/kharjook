'use client';

import { DirectionProvider } from '@base-ui/react/direction-provider';
import type { ReactNode } from 'react';
import { ConfirmProvider } from './Dialog';
import { ToastProvider } from './Toast';
import { TooltipProvider } from './Tooltip';

/**
 * Wrap the app once (in the root layout). Sets RTL for Base UI
 * (keyboard nav, popover sides) and mounts toast + confirm.
 */
export function DesignSystemProvider({ children }: { children: ReactNode }) {
  return (
    <DirectionProvider direction="rtl">
      <TooltipProvider delay={400}>
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </TooltipProvider>
    </DirectionProvider>
  );
}
