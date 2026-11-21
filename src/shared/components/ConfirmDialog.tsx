'use client';

/**
 * Old confirm API (`const { confirm } = useConfirm()` with `message` and
 * `variant`), kept for screens not yet rewritten. It now opens the
 * design-system dialog. New code: `useConfirm` from '@/design-system'.
 */
import type { ReactNode } from 'react';
import { useConfirm as useDsConfirm } from '@/design-system';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'primary';
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

/** No-op wrapper: the design-system dialog provider is in DesignSystemProvider. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useConfirm(): ConfirmContextValue {
  const confirm = useDsConfirm();
  return {
    // A short message becomes the title; a long one goes under a generic title.
    confirm: (o) =>
      confirm({
        title: o.title ?? (o.message.length <= 60 ? o.message : 'تأیید'),
        description: o.title || o.message.length > 60 ? o.message : undefined,
        confirmLabel: o.confirmLabel,
        cancelLabel: o.cancelLabel,
        tone: o.variant === 'danger' ? 'danger' : 'default',
      }),
  };
}
