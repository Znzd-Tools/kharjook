/**
 * Offline outbox for new transactions (UX plan S29). Each item carries a
 * client-made id, so sending it twice can never create a duplicate row.
 */
import { cacheGet, cacheSet } from '@/shared/lib/cache/idb-cache';

const KEY = 'outbox:v1';

export interface OutboxItem {
  id: string;
  payload: Record<string, unknown>;
  queuedAt: number;
}

const listeners = new Set<() => void>();
export function onOutboxChange(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
const notify = () => listeners.forEach((l) => l());

export async function readOutbox(): Promise<OutboxItem[]> {
  return (await cacheGet<OutboxItem[]>(KEY)) ?? [];
}

export async function enqueue(payload: Record<string, unknown>): Promise<OutboxItem> {
  const item: OutboxItem = { id: String(payload.id ?? crypto.randomUUID()), payload: { ...payload }, queuedAt: Date.now() };
  item.payload.id = item.id;
  const items = await readOutbox();
  await cacheSet(KEY, [...items, item]);
  notify();
  return item;
}

export async function removeFromOutbox(ids: string[]) {
  const items = await readOutbox();
  await cacheSet(KEY, items.filter((i) => !ids.includes(i.id)));
  notify();
}

/** True when a Supabase/network error means "no connection", not "bad data". */
export function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = String((err as { message?: string })?.message ?? err ?? '');
  return /Failed to fetch|NetworkError|network|Load failed|fetch failed/i.test(msg);
}
