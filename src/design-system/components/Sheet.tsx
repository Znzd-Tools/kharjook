'use client';

import { Drawer } from '@base-ui/react/drawer';
import { X } from '../icons';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface SheetProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Element that opens the sheet (uncontrolled use). */
  trigger?: ReactElement;
  title?: ReactNode;
  description?: ReactNode;
  /** Hide the visible title but keep it for screen readers. */
  hideTitle?: boolean;
  /** Content under the title that does not scroll (e.g. a search field). */
  header?: ReactNode;
  /** Sticky bottom area, usually the primary `Button fullWidth`. */
  footer?: ReactNode;
  /** `auto`: fits content up to 90% height. `full`: always 92%. */
  size?: 'auto' | 'full';
  /** Show a close (×) button in the header. Default true. */
  showClose?: boolean;
  children?: ReactNode;
  className?: string;
}

/**
 * Bottom sheet — the main overlay on mobile. Swipe down to close.
 * Use for pickers, forms and details. Prefer it over centered dialogs.
 */
export function Sheet({
  open,
  defaultOpen,
  onOpenChange,
  trigger,
  title,
  description,
  hideTitle,
  header,
  footer,
  size = 'auto',
  showClose = true,
  children,
  className,
}: SheetProps) {
  return (
    <Drawer.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange ? (o) => onOpenChange(o) : undefined}>
      {trigger && <Drawer.Trigger render={trigger} />}
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Backdrop
            className={cn(
              'fixed inset-0 z-(--ds-z-overlay) min-h-dvh bg-scrim',
              'opacity-[calc(1-var(--drawer-swipe-progress))] transition-opacity duration-[450ms] ease-emphasized',
              'data-swiping:duration-0 data-starting-style:opacity-0 data-ending-style:opacity-0',
              'data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]'
            )}
          />
          <Drawer.Viewport className="fixed inset-0 z-(--ds-z-overlay) flex items-end justify-center">
            <Drawer.Popup
              dir="rtl"
              className={cn(
                'relative flex w-full max-w-(--ds-max-width) flex-col rounded-t-sheet bg-panel text-fg shadow-overlay outline-none',
                size === 'full' ? 'h-[92dvh]' : 'max-h-[90dvh]',
                '[transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-[450ms] ease-emphasized',
                'data-swiping:select-none data-starting-style:[transform:translateY(100%)] data-ending-style:[transform:translateY(100%)]',
                'data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)]',
                className
              )}
            >
              <div className="shrink-0 touch-none px-5 pt-2.5 select-none">
                <div aria-hidden className="mx-auto h-1 w-9 rounded-full bg-line-strong" />
                {(title || showClose) && (
                  <div className={cn('flex items-center gap-3 pt-3 pb-2', hideTitle && !showClose && 'hidden')}>
                    <div className={cn('min-w-0 flex-1', hideTitle && 'sr-only')}>
                      {title && <Drawer.Title className="text-title text-fg">{title}</Drawer.Title>}
                      {description && (
                        <Drawer.Description className="text-caption text-fg-subtle">{description}</Drawer.Description>
                      )}
                    </div>
                    {showClose && (
                      <Drawer.Close
                        aria-label="بستن"
                        className="ds-focus inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-hover text-fg-muted hover:text-fg [&_svg]:size-4"
                      >
                        <X />
                      </Drawer.Close>
                    )}
                  </div>
                )}
                {header && <div className="pb-3">{header}</div>}
              </div>
              <Drawer.Content className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
                {children}
              </Drawer.Content>
              {footer && (
                <div className="shrink-0 border-t border-line bg-panel px-5 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px)+var(--drawer-keyboard-inset,0px))]">
                  {footer}
                </div>
              )}
              {!footer && <div className="shrink-0 pb-[env(safe-area-inset-bottom,0px)]" />}
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
}

/** Close button for use inside a Sheet's content or footer. */
export const SheetClose = Drawer.Close;
