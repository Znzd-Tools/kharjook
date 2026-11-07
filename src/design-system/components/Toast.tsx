'use client';

import { Toast as BaseToast } from '@base-ui/react/toast';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from '../icons';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export type ToastTone = 'neutral' | 'success' | 'error' | 'warning';

/** Global manager: call `toast.success('ثبت شد')` from anywhere. */
export const toastManager = BaseToast.createToastManager();

interface ToastOptions {
  description?: ReactNode;
  /** ms. 0 = stay until closed. Default 4000. */
  timeout?: number;
  /** Inline action, e.g. undo. */
  action?: { label: string; onClick: () => void };
}

function add(tone: ToastTone, title: ReactNode, o: ToastOptions = {}) {
  return toastManager.add({
    title,
    description: o.description,
    type: tone,
    timeout: o.timeout ?? (o.action ? 6000 : 4000),
    priority: tone === 'error' ? 'high' : 'low',
    actionProps: o.action ? { children: o.action.label, onClick: o.action.onClick } : undefined,
  });
}

export const toast = {
  show: (title: ReactNode, o?: ToastOptions) => add('neutral', title, o),
  success: (title: ReactNode, o?: ToastOptions) => add('success', title, o),
  error: (title: ReactNode, o?: ToastOptions) => add('error', title, o),
  warning: (title: ReactNode, o?: ToastOptions) => add('warning', title, o),
  dismiss: (id: string) => toastManager.close(id),
};

const ICON: Record<ToastTone, ReactNode> = {
  neutral: <Info className="text-fg-muted" />,
  success: <CheckCircle2 className="text-positive" />,
  error: <XCircle className="text-negative" />,
  warning: <AlertTriangle className="text-warning" />,
};

function ToastList() {
  const { toasts } = BaseToast.useToastManager();
  return toasts.map((t) => (
    <BaseToast.Root
      key={t.id}
      toast={t}
      swipeDirection={['down', 'right', 'left']}
      className={cn(
        'pointer-events-auto flex w-full items-center gap-3 rounded-card bg-elevated p-3.5 text-fg shadow-overlay select-none',
        '[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--toast-swipe-movement-y))]',
        'transition-[transform,opacity] duration-(--ds-duration-slow) ease-emphasized',
        'data-starting-style:translate-y-full data-starting-style:opacity-0 data-ending-style:opacity-0 data-limited:opacity-0'
      )}
    >
      <span className="shrink-0 [&_svg]:size-5">{ICON[(t.type as ToastTone) ?? 'neutral'] ?? ICON.neutral}</span>
      <BaseToast.Content className="flex min-w-0 flex-1 flex-col">
        <BaseToast.Title className="text-callout font-medium" />
        <BaseToast.Description className="text-caption text-fg-subtle" />
      </BaseToast.Content>
      <BaseToast.Action className="ds-focus h-8 shrink-0 rounded-full px-3 text-caption font-semibold text-accent-ink hover:bg-accent-soft" />
      <BaseToast.Close aria-label="بستن" className="ds-focus inline-flex size-7 shrink-0 items-center justify-center rounded-full text-fg-subtle hover:bg-hover [&_svg]:size-4">
        <X />
      </BaseToast.Close>
    </BaseToast.Root>
  ));
}

/** Toast renderer. Included in `DesignSystemProvider`. */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <BaseToast.Provider toastManager={toastManager} limit={3}>
      {children}
      <BaseToast.Portal>
        <BaseToast.Viewport
          dir="rtl"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--ds-tabbar-height)+env(safe-area-inset-bottom,0px)+0.75rem)] z-(--ds-z-toast) mx-auto flex w-[calc(100%-2rem)] max-w-(--ds-max-width) flex-col-reverse gap-2"
        >
          <ToastList />
        </BaseToast.Viewport>
      </BaseToast.Portal>
    </BaseToast.Provider>
  );
}
