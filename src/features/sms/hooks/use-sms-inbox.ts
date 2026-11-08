'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { supabase } from '@/shared/lib/supabase/client';
import type { SmsRow } from '../utils/suggest';
import { SMS_CHANGED } from '../utils/sms-client';

/* New-SMS count, shared by the tab badge, the ledger row and Home. */
let count = 0;
const listeners = new Set<() => void>();
let inflight: Promise<void> | null = null;
async function refreshCount() {
  inflight ??= (async () => {
    const { count: c, error } = await supabase.from('sms_inbox').select('id', { count: 'exact', head: true }).eq('status', 'new');
    const next = error ? 0 : c ?? 0;
    if (next !== count) {
      count = next;
      listeners.forEach((l) => l());
    }
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

/** Count of bank SMS waiting for review. Refreshes on focus, every 60 s and after changes. */
export function useSmsNewCount() {
  useEffect(() => {
    void refreshCount();
    const on = () => void refreshCount();
    window.addEventListener('focus', on);
    window.addEventListener(SMS_CHANGED, on);
    const id = window.setInterval(on, 60_000);
    return () => {
      window.removeEventListener('focus', on);
      window.removeEventListener(SMS_CHANGED, on);
      window.clearInterval(id);
    };
  }, []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => count,
    () => 0
  );
}

/** New SMS + the last 200 handled ones (for wallet learning and the archive). */
export function useSmsInbox() {
  const [rows, setRows] = useState<SmsRow[]>([]);
  const [loaded, setLoaded] = useState(false);

  const fetchRows = useCallback(async () => {
    const { data } = await supabase
      .from('sms_inbox')
      .select('id, sender, body, received_at, parsed, status, wallet_id, transaction_id')
      .order('received_at', { ascending: false })
      .limit(300);
    return (data ?? []) as SmsRow[];
  }, []);

  useEffect(() => {
    let alive = true;
    const load = () =>
      void fetchRows().then((r) => {
        if (!alive) return;
        setRows(r);
        setLoaded(true);
      });
    load();
    window.addEventListener(SMS_CHANGED, load);
    window.addEventListener('focus', load);
    return () => {
      alive = false;
      window.removeEventListener(SMS_CHANGED, load);
      window.removeEventListener('focus', load);
    };
  }, [fetchRows]);

  return { rows, loaded, setRows };
}
