'use client';

import { useEffect, useState } from 'react';
import { Section, Switch, toast } from '@/design-system';

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

const supported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/**
 * Push reminders on this device (UX plan S30). Shown only when the server
 * has VAPID keys. Telegram reminders keep working as before.
 */
export function PushSettingsSection() {
  const [state, setState] = useState<'loading' | 'unsupported' | 'off' | 'on'>('loading');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!VAPID) return;
    let alive = true;
    void (async () => {
      if (!supported()) return alive && setState('unsupported');
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (alive) setState(sub ? 'on' : 'off');
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!VAPID) return null;

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
          sub =
            (await reg.pushManager.getSubscription()) ??
            (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID!) }));
        } catch (e) {
          const name = (e as Error).name;
          toast.error(
            name === 'AbortError' || name === 'NotSupportedError'
              ? 'سرویس اعلان مرورگر در دسترس نیست. در Chrome این سرویس از گوگل است و در ایران بدون VPN کار نمی‌کند؛ با VPN یک بار روشن کن یا از اعلان تلگرام استفاده کن.'
              : `روشن کردن اعلان انجام نشد (${name})`
          );
          return;
        }
        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...sub.toJSON(), test: true }),
        });
        if (!res.ok) {
          await sub.unsubscribe().catch(() => undefined);
          toast.error(res.status === 503 ? 'اعلان روی سرور تنظیم نشده است' : `ذخیره اعلان انجام نشد (${res.status})`);
          return;
        }
        setState('on');
        toast.success('اعلان روی این دستگاه روشن شد؛ یک اعلان آزمایشی فرستادیم');
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
        toast.show('اعلان این دستگاه خاموش شد');
      }
    } catch (e) {
      toast.error(`تغییر اعلان انجام نشد: ${(e as Error).message || 'خطای نامعلوم'}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title="اعلان روی این دستگاه" description="یادآوری چک، قسط و اشتراک در روز سررسید و روز قبل، با دکمه «پرداخت شد».">
      <div className="rounded-card bg-panel p-4">
        {state === 'unsupported' ? (
          <p className="text-caption text-fg-muted">این مرورگر اعلان را پشتیبانی نمی‌کند. در iPhone اول برنامه را به صفحه اصلی اضافه کن.</p>
        ) : (
          <Switch label="یادآوری سررسیدها" checked={state === 'on'} disabled={state === 'loading' || busy} onCheckedChange={(on) => void toggle(on)} />
        )}
      </div>
    </Section>
  );
}
