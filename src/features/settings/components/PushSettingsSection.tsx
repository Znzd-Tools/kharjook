'use client';

import { useEffect, useState } from 'react';
import { Section, Switch, toast } from '@/design-system';

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
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
      const reg = await navigator.serviceWorker.ready;
      if (on) {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') {
          toast.error('اجازه اعلان داده نشد');
          return;
        }
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID) });
        const res = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...sub.toJSON(), test: true }),
        });
        if (!res.ok) {
          await sub.unsubscribe();
          throw new Error(String(res.status));
        }
        setState('on');
        toast.success('اعلان روی این دستگاه روشن شد');
      } else {
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
    } catch {
      toast.error('تغییر اعلان انجام نشد');
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
