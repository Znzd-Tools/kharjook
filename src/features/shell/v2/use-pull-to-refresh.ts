'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';

const TRIGGER = 72; // px of pull (after resistance) that starts a refresh
const MAX = 110;

/**
 * Pull down at the top of a scroll container to refresh (touch only).
 * Returns the current pull distance (for the indicator) and the busy state.
 */
export function usePullToRefresh(ref: RefObject<HTMLElement | null>, onRefresh: () => Promise<unknown>) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);
  const busyRef = useRef(false);
  const refreshRef = useRef(onRefresh);
  useEffect(() => {
    refreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const set = (v: number) => {
      pullRef.current = v;
      setPull(v);
    };
    const onStart = (e: TouchEvent) => {
      // Only from the very top, one finger, and not inside an open sheet/dialog.
      if (busyRef.current || el.scrollTop > 0 || e.touches.length !== 1) return;
      if ((e.target as HTMLElement | null)?.closest('[role="dialog"]')) return;
      start.current = e.touches[0]!.clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (start.current == null) return;
      const dy = e.touches[0]!.clientY - start.current;
      if (dy <= 0 || el.scrollTop > 0) {
        if (pullRef.current) set(0);
        return;
      }
      set(Math.min(MAX, dy * 0.5));
    };
    const onEnd = () => {
      if (start.current == null) return;
      start.current = null;
      if (pullRef.current >= TRIGGER) {
        busyRef.current = true;
        setBusy(true);
        set(TRIGGER * 0.75);
        void Promise.resolve(refreshRef.current())
          .catch(() => undefined)
          .finally(() => {
            busyRef.current = false;
            setBusy(false);
            set(0);
          });
      } else set(0);
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [ref]);

  return { pull, busy, ready: pull >= TRIGGER };
}
