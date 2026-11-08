'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/design-system';

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** The app's service worker, registered if needed, active within 10 s. */
async function swRegistration(): Promise<ServiceWorkerRegistration> {
  const reg = (await navigator.serviceWorker.getRegistration('/')) ?? (await navigator.serviceWorker.register('/sw.js', { scope: '/' }));
  if (reg.active) return reg;
  return await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('سرویس‌ورکر آماده نشد؛ صفحه را دوباره باز کن')), 10_000)),
  ]);
}

/** Push service behind an endpoint (who must reach the phone). */
function serviceOf(endpoint: string): string {
  if (endpoint.includes('googleapis.com')) return 'گوگل (FCM)';
  if (endpoint.includes('push.apple.com')) return 'اپل';
  if (endpoint.includes('mozilla')) return 'موزیلا';
  if (endpoint.includes('windows.com')) return 'مایکروسافت';
  return new URL(endpoint).host;
}

function sameKey(sub: PushSubscription, key: Uint8Array): boolean {
  const k = sub.options?.applicationServerKey;
  if (!k) return true; // older browsers do not expose it
  const a = new Uint8Array(k);
  return a.length === key.length && a.every((v, i) => v === key[i]);
}

export type TestResult = { ok: boolean; status: number | null; message: string | null; at: string; service: string };

const supported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/**
 * App notifications on THIS device: subscribe / unsubscribe and a test push
 * that shows the push service answer (which step fails, if any).
 */
export function useDevicePush() {
  const [state, setState] = useState<'loading' | 'unsupported' | 'off' | 'on'>('loading');
  const [busy, setBusy] = useState(false);
  const [perm, setPerm] = useState<NotificationPermission | null>(null);
  const [service, setService] = useState<string | null>(null);
  const [test, setTest] = useState<TestResult | null>(null);

  /** Save this device on the server and send a test push; show the push service answer. */
  const runTest = async (sub: PushSubscription) => {
    const res = await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sub.toJSON(), test: true }),
    });
    const json = (await res.json().catch(() => ({}))) as { test?: { ok: boolean; status: number | null; message: string | null } };
    const r: TestResult = {
      ok: res.ok && Boolean(json.test?.ok),
      status: json.test?.status ?? (res.ok ? null : res.status),
      message: json.test?.message ?? (res.ok ? null : 'ذخیره روی سرور انجام نشد'),
      at: new Date().toLocaleTimeString('fa-IR'),
      service: serviceOf(sub.endpoint),
    };
    setTest(r);
    return { saved: res.ok, result: r };
  };

  useEffect(() => {
    if (!VAPID) return;
    let alive = true;
    void (async () => {
      if (!supported()) return alive && setState('unsupported');
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (!alive) return;
      setPerm(Notification.permission);
      setService(sub ? serviceOf(sub.endpoint) : null);
      setState(sub ? 'on' : 'off');
    })();
    return () => {
      alive = false;
    };
  }, []);

  const toggle = async (on: boolean) => {
    setBusy(true);
    try {
      if (on) {
        // Ask first, inside the tap: Safari refuses a permission prompt after other awaits.
        const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
        if (perm !== 'granted') {
          toast.error(
            perm === 'denied'
              ? 'اعلان برای این سایت بسته است. از تنظیمات مرورگر (قفل کنار آدرس) اجازه اعلان را باز کن.'
              : 'اجازه اعلان داده نشد'
          );
          return;
        }
        const reg = await swRegistration();
        let sub: PushSubscription;
        try {
          const key = urlBase64ToUint8Array(VAPID!);
          let existing = await reg.pushManager.getSubscription();
          // A subscription made with an old server key can never receive: replace it.
          if (existing && !sameKey(existing, key)) {
            await existing.unsubscribe().catch(() => undefined);
            existing = null;
          }
          sub = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
        } catch (e) {
          const name = (e as Error).name;
          toast.error(
            name === 'AbortError' || name === 'NotSupportedError'
              ? 'سرویس اعلان مرورگر در دسترس نیست. در Chrome این سرویس از گوگل است و در ایران بدون VPN کار نمی‌کند؛ با VPN یک بار روشن کن یا از اعلان تلگرام استفاده کن.'
              : `روشن کردن اعلان انجام نشد (${name})`
          );
          return;
        }
        const { saved } = await runTest(sub);
        if (!saved) {
          await sub.unsubscribe().catch(() => undefined);
          toast.error('ذخیره اعلان روی سرور انجام نشد');
          return;
        }
        setPerm('granted');
        setService(serviceOf(sub.endpoint));
        setState('on');
        toast.success('اعلان روشن شد؛ یک اعلان آزمایشی فرستادیم');
      } else {
        const reg = await swRegistration();
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          await fetch('/api/push/subscribe', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: sub.endpoint }),
          });
          await sub.unsubscribe();
        }
        setState('off');
        setTest(null);
        setService(null);
        toast.show('اعلان این دستگاه خاموش شد');
      }
    } catch (e) {
      toast.error(`تغییر اعلان انجام نشد: ${(e as Error).message || 'خطای نامعلوم'}`);
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    try {
      const reg = await swRegistration();
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setState('off');
        toast.error('اشتراک این دستگاه پیدا نشد؛ دوباره روشن کن');
        return;
      }
      await runTest(sub);
    } catch (e) {
      toast.error(`ارسال آزمایشی انجام نشد: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const failHint = (t: TestResult) => {
    if (t.message === 'not_saved') return 'این دستگاه روی سرور ثبت نیست. خاموش و دوباره روشن کن.';
    if (t.status === 401 || t.status === 403) return 'کلید سرور با اشتراک این دستگاه نمی‌خواند. خاموش و دوباره روشن کن.';
    if (t.status === 404 || t.status === 410) return 'اشتراک این دستگاه منقضی شده. خاموش و دوباره روشن کن.';
    return `سرویس اعلان جواب داد: ${t.status ?? '—'} ${t.message ?? ''}`;
  };

  return { available: Boolean(VAPID), state, busy, perm, service, test, toggle, sendTest, failHint };
}
