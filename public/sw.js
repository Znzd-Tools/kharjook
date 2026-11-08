const SW_VERSION = 'khargook-shell-v4';
const APP_SHELL_CACHE = `${SW_VERSION}-app-shell`;
const RUNTIME_CACHE = `${SW_VERSION}-runtime`;
const OFFLINE_URL = '/login?source=pwa';
const SHELL_URLS = [OFFLINE_URL, '/manifest.webmanifest', '/logo.png', '/icon-192', '/icon', '/icon-maskable', '/apple-icon'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_SHELL_CACHE);
      await Promise.all(
        SHELL_URLS.map(async (url) => {
          try {
            const response = await fetch(url, { cache: 'no-store' });
            if (response.ok) await cache.put(url, response);
          } catch {
            // ignore and continue; install should not hard-fail on transient network
          }
        })
      );
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== APP_SHELL_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigation: network-first, fallback to cached login shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const network = await fetch(request);
          const runtime = await caches.open(RUNTIME_CACHE);
          runtime.put(request, network.clone());
          return network;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offlineShell = await caches.match(OFFLINE_URL);
          if (offlineShell) return offlineShell;
          return new Response('Offline', { status: 503, statusText: 'Offline' });
        }
      })()
    );
    return;
  }

  // Static same-origin assets: cache-first for app feel.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname === '/manifest.webmanifest' ||
    url.pathname === '/logo.png' ||
    url.pathname === '/icon-192' ||
    url.pathname === '/icon' ||
    url.pathname === '/icon-maskable' ||
    url.pathname === '/apple-icon'
  ) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, response.clone());
        }
        return response;
      })()
    );
  }
});

// Allow the page to trigger an immediate takeover after a SW update.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.__SW_VERSION__ = SW_VERSION;

// Web Push (UX plan S30): reminders with a one-tap "پرداخت شد".
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'خرجوک', body: event.data ? event.data.text() : '' };
  }
  const actions = data.settle ? [{ action: 'settle', title: 'پرداخت شد' }, { action: 'open', title: 'باز کردن' }] : [];
  event.waitUntil(
    self.registration.showNotification(data.title || 'خرجوک', {
      body: data.body || '',
      tag: data.tag,
      dir: 'rtl',
      lang: 'fa',
      icon: '/icon-192',
      badge: '/icon-192',
      actions,
      data: { url: data.url || '/', settle: data.settle || null },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  const n = event.notification;
  const { url, settle } = n.data || {};
  n.close();
  event.waitUntil(
    (async () => {
      if (event.action === 'settle' && settle) {
        try {
          const res = await fetch(settle.url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settle.body),
          });
          await self.registration.showNotification(res.ok ? 'ثبت شد ✓' : 'ثبت نشد', {
            body: res.ok ? 'پرداخت ثبت شد.' : 'برنامه را باز کن و دوباره امتحان کن.',
            tag: n.tag,
            dir: 'rtl',
            lang: 'fa',
            icon: '/icon-192',
            data: { url: url || '/' },
          });
          if (res.ok) return;
        } catch {
          // fall through and open the app
        }
      }
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const target = new URL(url || '/', self.location.origin).href;
      for (const c of all) {
        if ('focus' in c) {
          await c.focus();
          if ('navigate' in c) await c.navigate(target).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(target);
    })()
  );
});
