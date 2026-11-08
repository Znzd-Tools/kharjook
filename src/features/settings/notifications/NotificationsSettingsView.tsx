'use client';

/**
 * Settings → اعلان‌ها. Two parts:
 *  1. Channels: Telegram (connect / disconnect) and this device (app push).
 *  2. Notifications: one clean row each; tap → a sheet with two switches.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Avatar,
  Banner,
  Button,
  Checkbox,
  Disclosure,
  Field,
  List,
  ListRow,
  Section,
  SegmentedControl,
  Sheet,
  Skeleton,
  Switch,
  Text,
  TopBar,
  toast,
  useConfirm,
} from '@/design-system';
import { Bell, CalendarDays, Coins, FileText, Landmark, Percent, Receipt, TrendingUp, Zap } from '@/design-system/icons';
import { useSafeBack } from '@/shared/hooks/use-safe-back';
import type { NotifChannel, NotifKey } from '@/features/notifications/utils/notification-prefs';
import { useDevicePush } from './use-device-push';

type Matrix = Record<NotifKey, Record<NotifChannel, boolean>>;
interface Report {
  report_interval: 'daily' | 'weekly';
  report_day_of_week: number;
  show_cashflow_irt: boolean;
  show_cashflow_usd: boolean;
  show_portfolio_irt: boolean;
  show_portfolio_usd: boolean;
}
interface Data {
  channels: Matrix;
  telegram: { connected: boolean; username: string | null };
  push: { configured: boolean };
  report: Report;
}

type Tone = 'peach' | 'sky' | 'lemon' | 'lilac' | 'mint' | 'rose';
interface Item {
  key: NotifKey;
  title: string;
  when: string;
  about: string;
  icon: ReactNode;
  tone: Tone;
  /** Long text: Telegram only. */
  telegramOnly?: boolean;
}

const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'سررسیدها',
    items: [
      { key: 'due_today.check', title: 'چک امروز', when: '۱۰:۰۰', about: 'روز سررسید هر چک، با دکمه «پرداخت شد».', icon: <FileText />, tone: 'peach' },
      { key: 'due_today.installment', title: 'قسط امروز', when: '۱۰:۰۰', about: 'روز سررسید هر قسط، با دکمه «پرداخت شد».', icon: <Landmark />, tone: 'sky' },
      { key: 'due_today.subscription', title: 'اشتراک امروز', when: '۱۰:۰۰', about: 'روز تمدید هر اشتراک.', icon: <Zap />, tone: 'lemon' },
      {
        key: 'advance',
        title: 'یادآوری قبل از سررسید',
        when: '۱۰:۰۰',
        about: 'چند روز قبل از سررسید چک، قسط و اشتراک. تعداد روزها در فرم هر مورد است (پیش‌فرض ۲ روز).',
        icon: <CalendarDays />,
        tone: 'lilac',
      },
    ],
  },
  {
    title: 'هزینه‌ها',
    items: [
      { key: 'expense_alert', title: 'هر هزینه جدید', when: 'بلافاصله', about: 'بعد از ثبت هر هزینه: مبلغ و جمع هزینه امروز.', icon: <Receipt />, tone: 'rose' },
      { key: 'cap_alert', title: 'سقف ماهانه دسته‌ها', when: '۱۰:۰۰', about: 'وقتی هزینه یک دسته به ۸۰٪ و ۱۰۰٪ سقف ماهانه برسد.', icon: <Percent />, tone: 'peach' },
      { key: 'expense_reminder', title: 'یادآور ثبت هزینه‌ها', when: '۲۳:۰۰', about: 'هر شب تعداد و جمع هزینه‌های امروز، تا چیزی جا نماند.', icon: <Bell />, tone: 'mint' },
    ],
  },
  {
    title: 'گزارش و قیمت',
    items: [
      { key: 'price_update', title: 'به‌روزرسانی قیمت‌ها', when: '۱۰:۰۰', about: 'وقتی به‌روزرسانی روزانه قیمت‌ها تمام شد، با نرخ دلار.', icon: <Coins />, tone: 'lemon' },
      { key: 'report', title: 'گزارش دوره‌ای', when: '۱۰:۰۰', about: 'خلاصه درآمد، هزینه و ارزش سبد. متن بلند است، فقط در تلگرام.', icon: <TrendingUp />, tone: 'sky', telegramOnly: true },
    ],
  },
];

const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

function summary(m: Record<NotifChannel, boolean>, telegramOnly?: boolean): string {
  const t = m.telegram;
  const p = !telegramOnly && m.push;
  if (t && p) return 'تلگرام و اپ';
  if (t) return 'تلگرام';
  if (p) return 'اپ';
  return 'خاموش';
}

export function NotificationsSettingsView() {
  const goBack = useSafeBack('/settings');
  const confirm = useConfirm();
  const device = useDevicePush();
  const [data, setData] = useState<Data | null>(null);
  const [open, setOpen] = useState<Item | null>(null);
  const [tgBusy, setTgBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/notifications/channels').catch(() => null);
    if (res?.ok) setData((await res.json()) as Data);
  }, []);
  useEffect(() => {
    let alive = true;
    void fetch('/api/notifications/channels')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Data | null) => alive && j && setData(j))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const save = async (body: { channels?: Partial<Record<NotifKey, Partial<Record<NotifChannel, boolean>>>>; report?: Partial<Report> }, optimistic: Data) => {
    const prev = data;
    setData(optimistic);
    const res = await fetch('/api/notifications/channels', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (!res?.ok) {
      setData(prev);
      toast.error('ذخیره انجام نشد');
    }
  };

  const setChannel = (key: NotifKey, ch: NotifChannel, on: boolean) =>
    data && void save({ channels: { [key]: { [ch]: on } } }, { ...data, channels: { ...data.channels, [key]: { ...data.channels[key], [ch]: on } } });
  const setReport = (patch: Partial<Report>) => data && void save({ report: patch }, { ...data, report: { ...data.report, ...patch } });

  const connectTelegram = async () => {
    setTgBusy(true);
    try {
      const res = await fetch('/api/telegram/link', { method: 'POST' });
      const json = (await res.json()) as { linkUrl?: string; error?: string };
      if (!res.ok || !json.linkUrl) throw new Error(json.error ?? 'ساخت لینک انجام نشد');
      window.open(json.linkUrl, '_blank', 'noopener,noreferrer');
      toast.success('در تلگرام «Start» را بزن، بعد به اینجا برگرد.');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setTgBusy(false);
    }
  };
  const disconnectTelegram = async () => {
    if (!(await confirm({ title: 'اتصال تلگرام قطع شود؟', description: 'دیگر هیچ اعلانی در تلگرام نمی‌آید.', confirmLabel: 'قطع اتصال', tone: 'danger' }))) return;
    setTgBusy(true);
    const res = await fetch('/api/telegram/connection', { method: 'POST' }).catch(() => null);
    setTgBusy(false);
    if (!res?.ok) return toast.error('قطع اتصال انجام نشد');
    toast.show('اتصال تلگرام قطع شد');
    void load();
  };

  return (
    <div className="min-h-full bg-canvas pb-10">
      <TopBar onBack={() => goBack()} title="اعلان‌ها" />
      <div className="space-y-6 px-(--ds-gutter)">
        <Section title="کانال‌ها">
          {!data ? (
            <Skeleton className="h-32 rounded-card" />
          ) : (
            <List>
              <ListRow
                chevron={false}
                leading={<Avatar tone="sky" fallback={<Bell />} />}
                title="تلگرام"
                subtitle={data.telegram.connected ? `وصل${data.telegram.username ? ` · @${data.telegram.username}` : ''}` : 'وصل نیست'}
                trailing={
                  data.telegram.connected ? (
                    <Button size="sm" variant="ghost" loading={tgBusy} onClick={() => void disconnectTelegram()}>
                      قطع
                    </Button>
                  ) : (
                    <Button size="sm" variant="soft" loading={tgBusy} onClick={() => void connectTelegram()}>
                      اتصال
                    </Button>
                  )
                }
              />
              <ListRow
                chevron={false}
                leading={<Avatar tone="lilac" fallback={<Bell />} />}
                title="اپ روی این دستگاه"
                subtitle={
                  !device.available
                    ? 'روی سرور تنظیم نشده'
                    : device.state === 'unsupported'
                      ? 'این مرورگر پشتیبانی نمی‌کند (iPhone: اول به صفحه اصلی اضافه کن)'
                      : device.state === 'on'
                        ? `روشن${device.service ? ` · ${device.service}` : ''}`
                        : 'خاموش'
                }
                trailing={
                  device.available && device.state !== 'unsupported' ? (
                    <Switch
                      aria-label="اعلان اپ روی این دستگاه"
                      checked={device.state === 'on'}
                      disabled={device.state === 'loading' || device.busy}
                      onCheckedChange={(on) => void device.toggle(on)}
                    />
                  ) : undefined
                }
              />
            </List>
          )}
          {device.state === 'on' && (
            <Disclosure title="آزمایش و عیب‌یابی اعلان اپ" className="mt-2">
              <div className="space-y-3">
                <Text variant="caption" tone="subtle" className="block">
                  اجازه مرورگر: {device.perm === 'granted' ? 'داده شده' : device.perm === 'denied' ? 'بسته (از تنظیمات مرورگر باز کن)' : 'پرسیده نشده'}
                </Text>
                <Button size="sm" variant="soft" loading={device.busy} onClick={() => void device.sendTest()}>
                  ارسال اعلان آزمایشی
                </Button>
                {device.test &&
                  (device.test.ok ? (
                    <Banner tone="info" title={`سرور اعلان را به ${device.test.service} داد ✓ · ${device.test.at}`}>
                      اگر نرسید، مسیر {device.test.service} تا گوشی بسته است (در ایران برای گوگل معمولاً VPN لازم است).
                    </Banner>
                  ) : (
                    <Banner tone="warning" title="اعلان آزمایشی ارسال نشد">
                      {device.failHint(device.test)}
                    </Banner>
                  ))}
              </div>
            </Disclosure>
          )}
        </Section>

        {!data
          ? null
          : GROUPS.map((g) => (
              <Section key={g.title} title={g.title}>
                <List>
                  {g.items.map((it) => {
                    const m = data.channels[it.key];
                    const s = summary(m, it.telegramOnly);
                    return (
                      <ListRow
                        key={it.key}
                        onClick={() => setOpen(it)}
                        leading={<Avatar tone={it.tone} fallback={it.icon} />}
                        title={it.title}
                        subtitle={it.when}
                        trailing={<span className={s === 'خاموش' ? 'text-caption text-fg-subtle' : 'text-caption font-semibold text-accent-ink'}>{s}</span>}
                      />
                    );
                  })}
                </List>
              </Section>
            ))}
      </div>

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)} title={open?.title ?? ''}>
        {open && data && (
          <div className="space-y-4">
            <Text variant="callout" tone="muted" className="block">
              {open.about}
            </Text>
            <div className="space-y-3 rounded-card bg-sunken p-4">
              <Switch
                label="تلگرام"
                description={data.telegram.connected ? undefined : 'تلگرام وصل نیست؛ از «کانال‌ها» وصلش کن.'}
                checked={data.channels[open.key].telegram}
                onCheckedChange={(on) => setChannel(open.key, 'telegram', on)}
              />
              {!open.telegramOnly && (
                <Switch
                  label="اپ"
                  description={device.state === 'on' ? undefined : 'روی دستگاه‌هایی می‌آید که «اپ روی این دستگاه» در آن‌ها روشن است.'}
                  checked={data.channels[open.key].push}
                  onCheckedChange={(on) => setChannel(open.key, 'push', on)}
                />
              )}
            </div>
            {open.key === 'report' && (
              <div className="space-y-4">
                <Field label="هر چند وقت">
                  <SegmentedControl
                    aria-label="بازه گزارش"
                    value={data.report.report_interval}
                    onValueChange={(v) => setReport({ report_interval: v as Report['report_interval'] })}
                    options={[
                      { value: 'daily', label: 'روزانه' },
                      { value: 'weekly', label: 'هفتگی' },
                    ]}
                  />
                </Field>
                {data.report.report_interval === 'weekly' && (
                  <Field label="روز هفته">
                    <SegmentedControl
                      aria-label="روز گزارش هفتگی"
                      size="sm"
                      value={String(data.report.report_day_of_week)}
                      onValueChange={(v) => setReport({ report_day_of_week: Number(v) })}
                      options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d.slice(0, 1) }))}
                    />
                  </Field>
                )}
                <Field label="محتوای گزارش">
                  <div className="space-y-2">
                    <Checkbox label="درآمد و هزینه (تومان)" checked={data.report.show_cashflow_irt} onCheckedChange={(on) => setReport({ show_cashflow_irt: on })} />
                    <Checkbox label="درآمد و هزینه (دلار)" checked={data.report.show_cashflow_usd} onCheckedChange={(on) => setReport({ show_cashflow_usd: on })} />
                    <Checkbox label="ارزش سبد (تومان)" checked={data.report.show_portfolio_irt} onCheckedChange={(on) => setReport({ show_portfolio_irt: on })} />
                    <Checkbox label="ارزش سبد (دلار)" checked={data.report.show_portfolio_usd} onCheckedChange={(on) => setReport({ show_portfolio_usd: on })} />
                  </div>
                </Field>
              </div>
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}
