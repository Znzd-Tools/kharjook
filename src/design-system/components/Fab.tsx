'use client';

import { Plus } from '../icons';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { haptic } from '../lib/haptics';
import { useLongPress } from '../lib/use-long-press';

export interface FabProps {
  /** Tap: the default action (e.g. add expense). */
  onPress: () => void;
  /** Long press: open quick actions (`ActionSheet layout="grid"`). */
  onLongPress?: () => void;
  icon?: ReactNode;
  'aria-label': string;
  disabled?: boolean;
  className?: string;
}

/** Floating main action. One per app — lives in the TabBar center. */
export function Fab({ onPress, onLongPress, icon = <Plus />, disabled, className, ...props }: FabProps) {
  const press = useLongPress({
    onPress: () => {
      haptic('selection');
      onPress();
    },
    onLongPress: () => {
      haptic('medium');
      onLongPress?.();
    },
  });
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={props['aria-label']}
      aria-haspopup={onLongPress ? 'dialog' : undefined}
      {...(onLongPress ? press : { onClick: press.onClick })}
      className={cn(
        'ds-focus flex size-14 items-center justify-center rounded-full bg-accent text-fg-on-accent shadow-fab select-none',
        'transition-[transform,background-color] duration-(--ds-duration-fast) ease-standard hover:bg-accent-hover active:scale-90',
        'disabled:opacity-45 [&_svg]:size-6.5',
        className
      )}
    >
      {icon}
    </button>
  );
}
