'use client';

import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { toast } from '@/design-system';
import { supabase } from '@/shared/lib/supabase/client';
import { onOutboxChange, readOutbox, removeFromOutbox } from '@/shared/lib/outbox';
import { useData } from '@/features/portfolio/PortfolioProvider';

let queuedCount = 0;
const countListeners = new Set<() => void>();
const setQueuedCount = (n: number) => {
  queuedCount = n;
  countListeners.forEach((l) => l());
};

/** Number of transactions waiting to be sent. */
export function useQueuedCount() {
  return useSyncExternalStore(
    (l) => {
      countListeners.add(l);
      return () => countListeners.delete(l);
    },
    () => queuedCount,
    () => 0
  );
}

/**
 * Sends queued offline transactions when the app is online. Mounted once in
 * the shell. Duplicate-id errors count as sent (the row already exists).
 */
export function OutboxSync() {
  const { refresh } = useData();
  const busy = useRef(false);

  const flush = useCallback(async () => {
    const items = await readOutbox();
    setQueuedCount(items.length);
    if (busy.current || items.length === 0 || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    busy.current = true;
    try {
      const sent: string[] = [];
      for (const item of items) {
        const { error } = await supabase.from('transactions').insert([item.payload]);
        if (!error || error.code === '23505') sent.push(item.id);
        else break; // keep order; try again later
      }
      if (sent.length) {
        await removeFromOutbox(sent);
        await refresh();
        toast.success(`${sent.length.toLocaleString('fa-IR')} تراکنش در صف ارسال شد`);
      }
      setQueuedCount((await readOutbox()).length);
    } finally {
      busy.current = false;
    }
  }, [refresh]);

  useEffect(() => {
    const kick = () => void flush();
    const off = onOutboxChange(() => void readOutbox().then((i) => setQueuedCount(i.length)));
    kick();
    window.addEventListener('online', kick);
    const id = window.setInterval(kick, 60_000);
    return () => {
      off();
      window.removeEventListener('online', kick);
      window.clearInterval(id);
    };
  }, [flush]);

  return null;
}
