'use client';

import { Drawer } from '@base-ui/react/drawer';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface ActionSheetAction {
  key: string;
  label: ReactNode;
  icon?: ReactNode;
  description?: ReactNode;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  onSelect: () => void;
}

export interface ActionSheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactElement;
  title?: ReactNode;
  actions: ActionSheetAction[];
  /** Label of the separate cancel button. Default "انصراف". */
  cancelLabel?: string;
  /** `list`: rows. `grid`: big icon tiles (quick-add menu). */
  layout?: 'list' | 'grid';
}

/** Choose one action. Used for "+" quick actions and row overflow menus. */
export function ActionSheet({ open, onOpenChange, trigger, title, actions, cancelLabel = 'انصراف', layout = 'list' }: ActionSheetProps) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange ? (o) => onOpenChange(o) : undefined}>
      {trigger && <Drawer.Trigger render={trigger} />}
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-(--ds-z-overlay) bg-scrim opacity-[calc(1-var(--drawer-swipe-progress))] transition-opacity duration-[450ms] ease-emphasized data-swiping:duration-0 data-starting-style:opacity-0 data-ending-style:opacity-0" />
        <Drawer.Viewport className="fixed inset-0 z-(--ds-z-overlay) flex items-end justify-center">
          <Drawer.Popup
            dir="rtl"
            className={cn(
              'flex w-full max-w-(--ds-max-width) flex-col gap-2 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] outline-none',
              '[transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-[450ms] ease-emphasized',
              'data-starting-style:[transform:translateY(calc(100%+1rem))] data-ending-style:[transform:translateY(calc(100%+1rem))]'
            )}
          >
            <Drawer.Content className="overflow-hidden rounded-sheet bg-elevated shadow-overlay">
              <Drawer.Title className={cn(title ? 'px-5 pt-4 pb-2 text-center text-caption text-fg-subtle' : 'sr-only')}>
                {title ?? 'گزینه‌ها'}
              </Drawer.Title>
              {layout === 'grid' ? (
                <div className="grid grid-cols-3 gap-2 p-3">
                  {actions.map((a) => (
                    <Drawer.Close
                      key={a.key}
                      disabled={a.disabled}
                      onClick={a.onSelect}
                      className="ds-focus flex flex-col items-center gap-2 rounded-card px-2 py-4 text-caption font-medium text-fg transition-colors hover:bg-hover active:bg-pressed disabled:opacity-45 [&_svg]:size-5"
                    >
                      {a.icon && (
                        <span className={cn('flex size-11 items-center justify-center rounded-full', a.tone === 'danger' ? 'bg-negative-soft text-negative-ink' : 'bg-accent-soft text-accent-ink')}>
                          {a.icon}
                        </span>
                      )}
                      {a.label}
                    </Drawer.Close>
                  ))}
                </div>
              ) : (
                <ul className="flex flex-col py-1">
                  {actions.map((a, i) => (
                    <li key={a.key} className={cn(i > 0 && 'border-t border-line')}>
                      <Drawer.Close
                        disabled={a.disabled}
                        onClick={a.onSelect}
                        className={cn(
                          'ds-focus flex min-h-13 w-full items-center gap-3 px-5 py-3 text-start text-body transition-colors hover:bg-hover active:bg-pressed disabled:opacity-45 [&_svg]:size-5',
                          a.tone === 'danger' ? 'text-negative-ink' : 'text-fg'
                        )}
                      >
                        {a.icon && <span className={cn('shrink-0', a.tone !== 'danger' && 'text-fg-muted')}>{a.icon}</span>}
                        <span className="flex min-w-0 flex-col">
                          {a.label}
                          {a.description && <span className="text-caption text-fg-subtle">{a.description}</span>}
                        </span>
                      </Drawer.Close>
                    </li>
                  ))}
                </ul>
              )}
            </Drawer.Content>
            <Drawer.Close className="ds-focus h-13 rounded-sheet bg-elevated text-body font-semibold text-fg shadow-overlay hover:bg-hover">
              {cancelLabel}
            </Drawer.Close>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
