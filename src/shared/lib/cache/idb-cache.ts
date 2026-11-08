/**
 * Tiny IndexedDB key-value cache (no dependency). Every call is
 * best-effort: private mode, blocked storage or old browsers just skip
 * the cache — the app still works from the network.
 */
const DB = 'kharjook';
const STORE = 'kv';

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
      tx.oncomplete = () => db.close();
    } catch {
      resolve(null);
    }
  });
}

export const cacheGet = <T>(key: string) => run<T>('readonly', (s) => s.get(key) as IDBRequest<T>);
export const cacheSet = (key: string, value: unknown) => run('readwrite', (s) => s.put(value, key));
export const cacheClear = () => run('readwrite', (s) => s.clear());
