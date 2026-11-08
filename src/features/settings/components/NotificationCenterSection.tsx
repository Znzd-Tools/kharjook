'use client';

import { useEffect, useState } from 'react';
import { Checkbox, Section, Skeleton, Text, toast } from '@/design-system';
import type { NotifChannel, NotifKey } from '@/features/notifications/utils/notification-prefs';

type Matrix = Record<NotifKey, Record<NotifChannel, boolean>>;
interface Status {
  channels: Matrix;
  telegram: { connected: boolean; enabled: boolean };
  push: { configured: boolean };
}

const GROUPS: { title: string; rows: { key: NotifKey; label: string; hint: string }[] }[] = [
  {
    title: 'سررسید امروز (ساعت ۱۰:۰۰)',
    rows: [
      { key: 'due_today.check', label: 'چک‌ها', hint: 'چک‌هایی که امروز سررسید دارند' },
      { key: 'due_today.installment', label: 'اقساط وام', hint: 'قسط‌هایی که امروز سررسید دارند' },
      { key: 'due_today.subscription', label: 'اشتراک‌ها', hint: 'اشتراک‌هایی که امروز تمدید می‌شوند' },
    ],
  },
  {
    title: 'یادآوری‌ها',
    rows: [
      { key: 'advance', label: 'قبل از سررسید', hint: 'طبق «یادآوری قبل از سررسید» هر چک، قسط و اشتراک (۱۰:۰۰)' },
      { key: 'expense_reminder', label: 'ثبت هزینه‌های امروز', hint: 'هر شب ساعت ۲۳:۰۰ با تعداد و جمع هزینه‌های امروز' },
      { key: 'price_update', label: 'به‌روزرسانی قیمت‌ها', hint: 'وقتی به‌روزرسانی روزانه قیمت‌ها تمام شد' },
    ],
  },
];

/** Settings → مرکز اعلان‌ها: one switch per notification and channel. */
export function NotificationCenterSection() {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    void fetch('/api/notifications/channels')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Status | null) => j && setStatus(j))
      .catch(() => undefined);
  }, []);

  const toggle = async (key: NotifKey, channel: NotifChannel, on: boolean) => {
    if (!status) return;
    const prev = status;
    setStatus({ ...status, channels: { ...status.channels, [key]: { ...status.channels[key], [channel]: on } } });
    const res = await fetch('/api/notifications/channels', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channels: { [key]: { [channel]: on } } }),
    }).catch(() => null);
    if (!res?.ok) {
      setStatus(prev);
      toast.error('ذخیره انجام نشد');
    }
  };

  const tgOff = status && (!status.telegram.connected || !status.telegram.enabled);

  return (
    <Section title="مرکز اعلان‌ها" description="هر اعلان را برای تلگرام و اپ جدا روشن یا خاموش کن.">
      <div className="space-y-4 rounded-card bg-panel p-4">
        {!status ? (
          <div className="space-y-2">
            <Skeleton className="h-10 rounded-control" />
            <Skeleton className="h-10 rounded-control" />
          </div>
        ) : (
          <>
            {(tgOff || !status.push.configured) && (
              <Text variant="caption" tone="subtle" className="block">
                {tgOff ? (status.telegram.connected ? 'اعلان‌های تلگرام در بخش بالا خاموش است. ' : 'تلگرام وصل نیست؛ از بخش بالا وصلش کن. ') : ''}
                {!status.push.configured ? 'اعلان اپ روی سرور تنظیم نشده.' : ''}
              </Text>
            )}
            {GROUPS.map((g) => (
              <div key={g.title} role="group" aria-label={g.title} className="space-y-2">
                <div className="grid grid-cols-[1fr_3.5rem_3.5rem] items-end gap-2">
                  <Text variant="caption" tone="muted" className="font-semibold">
                    {g.title}
                  </Text>
                  <Text variant="micro" tone="subtle" className="text-center">
                    تلگرام
                  </Text>
                  <Text variant="micro" tone="subtle" className="text-center">
                    اپ
                  </Text>
                </div>
                <ul className="divide-y divide-line rounded-control bg-sunken">
                  {g.rows.map((row) => (
                    <li key={row.key} className="grid grid-cols-[1fr_3.5rem_3.5rem] items-center gap-2 px-3 py-2.5">
                      <span className="min-w-0">
                        <span className="block text-callout text-fg">{row.label}</span>
                        <span className="block text-caption text-fg-subtle">{row.hint}</span>
                      </span>
                      <span className="flex justify-center">
                        <Checkbox
                          aria-label={`${row.label} در تلگرام`}
                          checked={status.channels[row.key].telegram}
                          onCheckedChange={(on) => void toggle(row.key, 'telegram', on)}
                        />
                      </span>
                      <span className="flex justify-center">
                        <Checkbox
                          aria-label={`${row.label} در اپ`}
                          checked={status.channels[row.key].push}
                          onCheckedChange={(on) => void toggle(row.key, 'push', on)}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <Text variant="caption" tone="subtle" className="block">
              اعلان اپ فقط روی دستگاه‌هایی می‌آید که «اعلان روی این دستگاه» در آن‌ها روشن است. زمان‌ها به وقت تهران است و ممکن است تا چند دقیقه دیرتر برسد.
            </Text>
          </>
        )}
      </div>
    </Section>
  );
}
