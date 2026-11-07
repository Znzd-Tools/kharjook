'use client';

import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Dialog as BaseDialog } from '@base-ui/react/dialog';
import { createContext, useCallback, useContext, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Button } from './Button';

const backdrop = cn(
  'fixed inset-0 z-(--ds-z-overlay) bg-scrim transition-opacity duration-(--ds-duration-base)',
  'data-starting-style:opacity-0 data-ending-style:opacity-0'
);
const popup = cn(
  'fixed top-1/2 left-1/2 z-(--ds-z-overlay) w-[calc(100vw-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2',
  'rounded-sheet bg-elevated p-6 text-fg shadow-overlay outline-none',
  'transition-[opacity,scale] duration-(--ds-duration-base) ease-emphasized',
  'data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0'
);

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactElement;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** Action buttons, end-aligned. */
  actions?: ReactNode;
  className?: string;
}

/** Centered dialog. Use rarely — prefer `Sheet` on mobile. */
export function Dialog({ open, defaultOpen, onOpenChange, trigger, title, description, children, actions, className }: DialogProps) {
  return (
    <BaseDialog.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange ? (o) => onOpenChange(o) : undefined}>
      {trigger && <BaseDialog.Trigger render={trigger} />}
      <BaseDialog.Portal>
        <BaseDialog.Backdrop className={backdrop} />
        <BaseDialog.Popup className={cn(popup, className)} dir="rtl">
          <BaseDialog.Title className="text-title text-fg">{title}</BaseDialog.Title>
          {description && <BaseDialog.Description className="mt-1.5 text-callout text-fg-muted">{description}</BaseDialog.Description>}
          {children && <div className="mt-4">{children}</div>}
          {actions && <div className="mt-6 flex gap-2 [&>*]:flex-1">{actions}</div>}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

export const DialogClose = BaseDialog.Close;

/* ------------------------------------------------------------------ */
/* Confirm                                                             */
/* ------------------------------------------------------------------ */

export interface ConfirmOptions {
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions use the danger button. */
  tone?: 'default' | 'danger';
}

export interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

/** Controlled confirmation. Usually you want `useConfirm()` instead. */
export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = 'تأیید',
  cancelLabel = 'انصراف',
  tone = 'default',
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => onOpenChange(o)}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className={backdrop} />
        <AlertDialog.Popup className={popup} dir="rtl">
          <AlertDialog.Title className="text-title text-fg">{title}</AlertDialog.Title>
          {description && <AlertDialog.Description className="mt-1.5 text-callout text-fg-muted">{description}</AlertDialog.Description>}
          <div className="mt-6 flex gap-2 [&>*]:flex-1">
            <AlertDialog.Close render={<Button variant="secondary" />}>{cancelLabel}</AlertDialog.Close>
            <Button
              variant={tone === 'danger' ? 'danger' : 'primary'}
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;
const ConfirmContext = createContext<ConfirmFn | null>(null);

/** Provides `useConfirm()`. Included in `DesignSystemProvider`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { open: boolean }) | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    resolver.current?.(false);
    setState({ ...options, open: true });
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <ConfirmDialog
          {...state}
          onConfirm={() => {
            resolver.current?.(true);
            resolver.current = null;
          }}
          onOpenChange={(o) => {
            if (!o) {
              resolver.current?.(false);
              resolver.current = null;
              setState((s) => (s ? { ...s, open: false } : s));
            }
          }}
        />
      )}
    </ConfirmContext.Provider>
  );
}

/** `const ok = await confirm({ title: 'حذف شود؟', tone: 'danger' })` */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider> (or DesignSystemProvider).');
  return ctx;
}
