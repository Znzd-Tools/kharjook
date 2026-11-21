'use client';

/**
 * Old toast API (`useToast()`), kept for screens not yet rewritten.
 * It now shows the design-system toast, so every screen looks the same.
 * New code: `import { toast } from '@/design-system'`.
 */
import type { ReactNode } from 'react';
import { toast } from '@/design-system';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  /** Auto-dismiss after N ms. 0 = stay until closed. */
  duration?: number;
  action?: ToastAction;
}

export interface ToastApi {
  success: (message: string, opts?: ToastOptions) => string;
  error: (message: string, opts?: ToastOptions) => string;
  info: (message: string, opts?: ToastOptions) => string;
  dismiss: (id: string) => void;
}

const map = (o?: ToastOptions) => (o ? { timeout: o.duration, action: o.action } : undefined);

const api: ToastApi = {
  success: (m, o) => toast.success(m, map(o)),
  error: (m, o) => toast.error(m, map(o)),
  info: (m, o) => toast.show(m, map(o)),
  dismiss: (id) => toast.dismiss(id),
};

/** No-op wrapper: the design-system toast renderer is in DesignSystemProvider. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useToast(): ToastApi {
  return api;
}
