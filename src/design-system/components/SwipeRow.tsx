'use client';

import { useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { haptic } from '../lib/haptics';

export interface SwipeAction {
  key: string;
  label: string;
  icon: ReactNode;
  tone?: 'accent' | 'positive' | 'negative' | 'neutral';
  onAction: () => void;
}

export interface SwipeRowProps {
  children: ReactNode;
  /** Actions on the trailing (left) edge, shown by dragging the row right. Max 3. */
  actions: SwipeAction[];
  className?: string;
}

const TONE = {
  accent: 'bg-accent text-fg-on-accent',
  positive: 'bg-positive text-fg-on-accent',
  negative: 'bg-negative text-fg-on-accent',
  neutral: 'bg-line-strong text-fg',
} as const;

const ACTION_W = 72;

/**
 * Swipe a row to reveal actions (edit, duplicate, delete, mark paid).
 * Actions are also reachable without gestures: long-press or row menu
 * must offer the same actions for accessibility.
 */
export function SwipeRow({ children, actions, className }: SwipeRowProps) {
  const max = actions.length * ACTION_W;
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; base: number; axis: 'x' | 'y' | null } | null>(null);
  // The click that ends a drag must not toggle the row again.
  const justDragged = useRef(false);

  const onPointerDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, base: dx, axis: null };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (!s.axis) {
      if (Math.abs(mx) < 6 && Math.abs(my) < 6) return;
      s.axis = Math.abs(mx) > Math.abs(my) ? 'x' : 'y';
      if (s.axis === 'x') {
        setDragging(true);
        e.currentTarget.setPointerCapture(e.pointerId);
      }
    }
    if (s.axis !== 'x') return;
    // RTL mirror of iOS trailing actions: actions sit on the left (the
    // trailing edge); dragging the row to the right reveals them.
    const next = Math.max(0, Math.min(max + 24, s.base + mx));
    setDx(next);
  };
  const onPointerUp = () => {
    const s = start.current;
    start.current = null;
    if (!s || s.axis !== 'x') return;
    justDragged.current = true;
    // Some touch browsers send no click after a drag: clear the guard soon.
    window.setTimeout(() => {
      justDragged.current = false;
    }, 350);
    setDragging(false);
    const open = dx > max / 2;
    if (open && s.base === 0) haptic('light');
    setDx(open ? max : 0);
  };

  return (
    <div className={cn('relative overflow-hidden', className)} dir="rtl">
      <div className="absolute inset-y-0 left-0 flex" style={{ width: max }} aria-hidden={dx === 0}>
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            tabIndex={dx === 0 ? -1 : 0}
            onClick={() => {
              haptic('selection');
              setDx(0);
              a.onAction();
            }}
            className={cn('ds-focus flex flex-1 flex-col items-center justify-center gap-1 text-micro font-medium [&_svg]:size-5', TONE[a.tone ?? 'neutral'])}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClickCapture={(e) => {
          if (justDragged.current) {
            justDragged.current = false;
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          if (dx !== 0) {
            e.preventDefault();
            e.stopPropagation();
            setDx(0);
          }
        }}
        className={cn('relative bg-panel touch-pan-y', !dragging && 'transition-transform duration-(--ds-duration-base) ease-emphasized')}
        style={{ transform: `translateX(${dx}px)` }}
      >
        {children}
      </div>
    </div>
  );
}
