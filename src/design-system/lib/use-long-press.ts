'use client';

import { useCallback, useRef } from 'react';

export interface LongPressOptions {
  /** Hold time in ms. Default 450. */
  delay?: number;
  onLongPress: () => void;
  onPress?: () => void;
}

/**
 * Pointer-based long press. Returns props to spread on any element.
 * A long press cancels the normal press.
 */
export function useLongPress({ delay = 450, onLongPress, onPress }: LongPressOptions) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);
  const start = useRef<{ x: number; y: number } | null>(null);

  const clear = useCallback(() => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      clear();
      timer.current = window.setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, delay);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!start.current) return;
      if (Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) clear();
    },
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClick: (e: React.MouseEvent) => {
      if (fired.current) {
        e.preventDefault();
        fired.current = false;
        return;
      }
      onPress?.();
    },
  };
}
